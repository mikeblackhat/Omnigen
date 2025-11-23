import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { getGeminiClient } from '../services/geminiService';
import { Model } from '../types';
import { createPcmBlob, decode, decodeAudioData, blobToBase64 } from '../utils/audio';

const AudioLab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'tts' | 'transcribe'>('live');
  
  // -- TTS State --
  const [ttsInput, setTtsInput] = useState('');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // -- Transcribe State --
  const [transcribeFile, setTranscribeFile] = useState<File | null>(null);
  const [transcribeResult, setTranscribeResult] = useState('');
  const [transcribeLoading, setTranscribeLoading] = useState(false);

  // -- Live API State & Refs --
  const [liveConnected, setLiveConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Live API Contexts
  const sessionRef = useRef<any>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Cleanup Live API
  const stopLiveSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    if (inputContextRef.current) {
        inputContextRef.current.close();
        inputContextRef.current = null;
    }
    if (outputContextRef.current) {
        outputContextRef.current.close();
        outputContextRef.current = null;
    }
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    setLiveConnected(false);
    setLogs(prev => [...prev, "Session ended."]);
  };

  useEffect(() => {
    return () => stopLiveSession();
  }, []);

  const startLiveSession = async () => {
    try {
        setLogs(prev => [...prev, "Connecting..."]);
        const client = getGeminiClient();
        
        // Setup Audio Contexts
        inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        const outputNode = outputContextRef.current.createGain();
        outputNode.connect(outputContextRef.current.destination);

        // Get User Media
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const sessionPromise = client.live.connect({
            model: Model.AUDIO_LIVE,
            callbacks: {
                onopen: () => {
                    setLogs(prev => [...prev, "Connected! Start speaking."]);
                    setLiveConnected(true);

                    // Setup Input Stream
                    if (!inputContextRef.current || !streamRef.current) return;
                    
                    sourceRef.current = inputContextRef.current.createMediaStreamSource(streamRef.current);
                    processorRef.current = inputContextRef.current.createScriptProcessor(4096, 1, 1);
                    
                    processorRef.current.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcmBlob = createPcmBlob(inputData);
                        sessionPromise.then(session => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };

                    sourceRef.current.connect(processorRef.current);
                    processorRef.current.connect(inputContextRef.current.destination);
                },
                onmessage: async (msg: LiveServerMessage) => {
                    const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio && outputContextRef.current) {
                        const ctx = outputContextRef.current;
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                        
                        const audioBuffer = await decodeAudioData(
                            decode(base64Audio),
                            ctx,
                            24000,
                            1
                        );
                        
                        const source = ctx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputNode);
                        source.addEventListener('ended', () => {
                            sourcesRef.current.delete(source);
                        });
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(source);
                    }
                    
                    if (msg.serverContent?.interrupted) {
                         setLogs(prev => [...prev, "Interrupted."]);
                         sourcesRef.current.forEach(s => s.stop());
                         sourcesRef.current.clear();
                         nextStartTimeRef.current = 0;
                    }
                },
                onclose: () => {
                    setLogs(prev => [...prev, "Connection closed."]);
                    setLiveConnected(false);
                },
                onerror: (e) => {
                    console.error(e);
                    setLogs(prev => [...prev, "Error occurred."]);
                }
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
                }
            }
        });
        
        sessionRef.current = await sessionPromise;

    } catch (e: any) {
        alert("Failed to start live session: " + e.message);
        setLiveConnected(false);
    }
  };

  const handleTTS = async () => {
      if(!ttsInput) return;
      setTtsLoading(true);
      try {
        const client = getGeminiClient();
        const response = await client.models.generateContent({
            model: Model.TTS,
            contents: { parts: [{ text: ttsInput }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                }
            }
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if(base64Audio) {
            // Need to decode PCM to play in browser effectively or wrap in wav container.
            // Simplified: Use AudioContext to play immediately
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
            const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
            
            // Create a WAV file (simplified approach or just play it)
            // For UI feedback, let's just play it
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.start();
            setLogs(prev => [...prev, "Playing generated speech..."]);
        }

      } catch (e: any) {
          alert("TTS Failed: " + e.message);
      } finally {
          setTtsLoading(false);
      }
  };

  const handleTranscribe = async () => {
      if(!transcribeFile) return;
      setTranscribeLoading(true);
      try {
        const base64 = await blobToBase64(transcribeFile);
        const client = getGeminiClient();
        const response = await client.models.generateContent({
            model: Model.FLASH,
            contents: {
                parts: [
                    { inlineData: { mimeType: transcribeFile.type, data: base64 } },
                    { text: "Transcribe this audio file." }
                ]
            }
        });
        setTranscribeResult(response.text || "No transcription available.");
      } catch (e: any) {
          alert("Transcription failed: " + e.message);
      } finally {
          setTranscribeLoading(false);
      }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex gap-4 border-b border-slate-700 pb-2">
         <button onClick={() => setActiveTab('live')} className={`px-4 py-2 rounded-lg ${activeTab === 'live' ? 'bg-red-600 text-white' : 'text-slate-400'}`}>Live Conversation</button>
         <button onClick={() => setActiveTab('tts')} className={`px-4 py-2 rounded-lg ${activeTab === 'tts' ? 'bg-red-600 text-white' : 'text-slate-400'}`}>Text to Speech</button>
         <button onClick={() => setActiveTab('transcribe')} className={`px-4 py-2 rounded-lg ${activeTab === 'transcribe' ? 'bg-red-600 text-white' : 'text-slate-400'}`}>Transcribe</button>
      </div>

      <div className="flex-1 bg-slate-800 rounded-xl p-6 overflow-y-auto">
         {activeTab === 'live' && (
             <div className="flex flex-col items-center justify-center h-full space-y-6">
                 <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${liveConnected ? 'bg-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-slate-700'}`}>
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                     </svg>
                 </div>
                 
                 {!liveConnected ? (
                     <button onClick={startLiveSession} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transform hover:scale-105 transition-all">
                         Start Conversation
                     </button>
                 ) : (
                     <button onClick={stopLiveSession} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-full text-lg">
                         End Session
                     </button>
                 )}
                 
                 <div className="w-full max-w-md bg-slate-900 rounded-lg p-4 h-48 overflow-y-auto text-xs text-mono text-green-400 border border-slate-700">
                     {logs.map((l, i) => <div key={i}>{l}</div>)}
                 </div>
             </div>
         )}

         {activeTab === 'tts' && (
             <div className="space-y-4 max-w-2xl mx-auto">
                 <h3 className="text-xl font-semibold">Gemini 2.5 TTS</h3>
                 <textarea 
                    value={ttsInput} 
                    onChange={e => setTtsInput(e.target.value)} 
                    placeholder="Enter text to speak..."
                    className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
                 />
                 <button 
                    onClick={handleTTS} 
                    disabled={ttsLoading}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
                 >
                     {ttsLoading ? 'Generating...' : 'Speak'}
                 </button>
                 <div className="text-sm text-slate-500">Audio will play automatically upon generation.</div>
             </div>
         )}

         {activeTab === 'transcribe' && (
             <div className="space-y-4 max-w-2xl mx-auto">
                 <h3 className="text-xl font-semibold">Audio Transcription</h3>
                 <input 
                    type="file" 
                    accept="audio/*" 
                    onChange={e => setTranscribeFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-red-600 file:text-white file:border-0 hover:file:bg-red-700"
                 />
                 <button 
                    onClick={handleTranscribe} 
                    disabled={transcribeLoading || !transcribeFile}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg"
                 >
                     {transcribeLoading ? 'Transcribing...' : 'Transcribe'}
                 </button>
                 {transcribeResult && (
                     <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 whitespace-pre-wrap">
                         {transcribeResult}
                     </div>
                 )}
             </div>
         )}
      </div>
    </div>
  );
};

export default AudioLab;