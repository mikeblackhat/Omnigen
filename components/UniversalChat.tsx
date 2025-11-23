import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { getGeminiClient } from '../services/geminiService';
import { Model, ChatMessage } from '../types';

type ChatMode = 'general' | 'fast' | 'thinking' | 'search' | 'maps';

const UniversalChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>('general');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setInput('');

    try {
      const client = getGeminiClient();
      let modelName = Model.PRO; // Default
      let config: any = {};
      
      // Configure based on mode
      switch (mode) {
        case 'fast':
          modelName = Model.FLASH_LITE;
          break;
        case 'thinking':
          modelName = Model.PRO;
          config = { thinkingConfig: { thinkingBudget: 32768 } };
          break;
        case 'search':
          modelName = Model.FLASH;
          config = { tools: [{ googleSearch: {} }] };
          break;
        case 'maps':
          modelName = Model.FLASH;
          config = { 
            tools: [{ googleMaps: {} }],
            toolConfig: {
                retrievalConfig: {
                  latLng: { latitude: 37.7749, longitude: -122.4194 } // Default fallback
                }
            }
          };
          // Try to get actual location
          if (navigator.geolocation) {
             try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) => 
                  navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
                );
                config.toolConfig.retrievalConfig.latLng = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude
                };
             } catch (e) {
                console.warn("Location access denied, using default.");
             }
          }
          break;
        case 'general':
        default:
          modelName = Model.PRO;
          break;
      }

      const response = await client.models.generateContent({
        model: modelName,
        contents: userMsg.text,
        config: config
      });

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const searchLinks = groundingChunks?.flatMap(c => c.web ? [{uri: c.web.uri, title: c.web.title}] : []) || [];
      const mapLinks = groundingChunks?.flatMap(c => c.maps ? [{uri: c.maps.uri, title: c.maps.title}] : []) || [];

      const botMsg: ChatMessage = {
        role: 'model',
        text: response.text || "No text response generated.",
        timestamp: new Date(),
        grounding: {
            search: searchLinks as any,
            maps: mapLinks as any
        }
      };
      
      setMessages(prev => [...prev, botMsg]);

    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: `Error: ${error.message}`, 
        timestamp: new Date() 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 rounded-xl overflow-hidden border border-slate-700">
      <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center flex-wrap gap-2">
        <h2 className="font-semibold text-lg">OmniChat</h2>
        <div className="flex gap-2 text-xs bg-slate-900 p-1 rounded-lg">
          {(['general', 'fast', 'thinking', 'search', 'maps'] as ChatMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md transition-colors capitalize ${
                mode === m ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'
            }`}>
              <div className="whitespace-pre-wrap">{msg.text}</div>
              
              {/* Grounding Sources */}
              {msg.grounding?.search && msg.grounding.search.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-600/50">
                   <p className="text-xs font-bold text-slate-400 mb-1">Sources:</p>
                   <ul className="text-xs space-y-1">
                     {msg.grounding.search.map((link, i) => (
                        <li key={i}>
                            <a href={link.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate block">
                                {link.title || link.uri}
                            </a>
                        </li>
                     ))}
                   </ul>
                </div>
              )}

              {msg.grounding?.maps && msg.grounding.maps.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-600/50">
                   <p className="text-xs font-bold text-slate-400 mb-1">Locations:</p>
                   <ul className="text-xs space-y-1">
                     {msg.grounding.maps.map((link, i) => (
                        <li key={i}>
                            <a href={link.uri} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline truncate block">
                                {link.title || "View on Maps"}
                            </a>
                        </li>
                     ))}
                   </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
            <div className="flex justify-start">
                <div className="bg-slate-700 rounded-2xl px-4 py-3 animate-pulse text-slate-400">
                    Thinking...
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={mode === 'thinking' ? "Ask a complex question..." : "Type a message..."}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2 text-center">
            Using {mode === 'thinking' ? 'Gemini 3 Pro (Thinking Budget: 32k)' : 
                   mode === 'fast' ? 'Gemini 2.5 Flash Lite' : 
                   mode === 'search' || mode === 'maps' ? 'Gemini 2.5 Flash' : 'Gemini 3 Pro'}
        </p>
      </div>
    </div>
  );
};

export default UniversalChat;