import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { getGeminiClient, ensurePaidKey } from '../services/geminiService';
import { Model, GeneratedMedia } from '../types';
import { blobToBase64 } from '../utils/audio';

type Tab = 'gen-image' | 'edit-image' | 'gen-video';

const CreativeStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('gen-image');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedMedia | null>(null);
  
  // Image Gen Params
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  
  // Image Edit Params
  const [baseImage, setBaseImage] = useState<File | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setBaseImage(e.target.files[0]);
    }
  };

  const generateImage = async () => {
    if (!prompt) return;
    setLoading(true);
    setResult(null);
    try {
        await ensurePaidKey();
        const client = getGeminiClient(); // New client after key selection
        const response = await client.models.generateContent({
            model: Model.PRO_IMAGE,
            contents: { parts: [{ text: prompt }] },
            config: {
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: imageSize
                }
            }
        });
        
        // Find image part
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                setResult({
                    type: 'image',
                    url: `data:image/png;base64,${part.inlineData.data}`,
                    mimeType: 'image/png'
                });
                break;
            }
        }
    } catch (e: any) {
        alert("Generation failed: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  const editImage = async () => {
    if (!prompt || !baseImage) return;
    setLoading(true);
    setResult(null);
    try {
        const base64Data = await blobToBase64(baseImage);
        const client = getGeminiClient();
        const response = await client.models.generateContent({
            model: Model.FLASH_IMAGE,
            contents: {
                parts: [
                    { inlineData: { mimeType: baseImage.type, data: base64Data } },
                    { text: prompt }
                ]
            }
        });

         for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                setResult({
                    type: 'image',
                    url: `data:image/png;base64,${part.inlineData.data}`,
                    mimeType: 'image/png'
                });
                break;
            }
        }
    } catch (e: any) {
        alert("Edit failed: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  const generateVideo = async () => {
    if (!prompt && !baseImage) return;
    setLoading(true);
    setResult(null);

    try {
        await ensurePaidKey();
        const client = getGeminiClient();
        
        let contents: any = {
            model: Model.VEO_FAST,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9' // Veo supports these
            }
        };

        if (prompt) contents.prompt = prompt;
        if (baseImage) {
             const base64Data = await blobToBase64(baseImage);
             contents.image = {
                imageBytes: base64Data,
                mimeType: baseImage.type
             };
        }

        let operation = await client.models.generateVideos(contents);

        // Polling
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await client.operations.getVideosOperation({ operation: operation });
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (videoUri) {
            // Fetch the actual bytes using the key
            const videoRes = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
            const videoBlob = await videoRes.blob();
            const videoUrl = URL.createObjectURL(videoBlob);
            setResult({
                type: 'video',
                url: videoUrl,
                mimeType: 'video/mp4'
            });
        }

    } catch (e: any) {
        alert("Video generation failed: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex gap-4 border-b border-slate-700 pb-2">
        {(['gen-image', 'edit-image', 'gen-video'] as Tab[]).map(tab => (
           <button
             key={tab}
             onClick={() => { setActiveTab(tab); setResult(null); }}
             className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'
             }`}
           >
             {tab === 'gen-image' ? 'Pro Image Gen' : tab === 'edit-image' ? 'Edit Image' : 'Veo Video'}
           </button> 
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full overflow-y-auto">
        {/* Controls */}
        <div className="space-y-6 bg-slate-800 p-6 rounded-xl h-fit">
            
            {/* Image Upload for Edit/Video */}
            {(activeTab === 'edit-image' || activeTab === 'gen-video') && (
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                        {activeTab === 'edit-image' ? 'Upload Image to Edit' : 'Source Image (Optional)'}
                    </label>
                    <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="block w-full text-sm text-slate-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-purple-600 file:text-white
                        hover:file:bg-purple-700"
                    />
                </div>
            )}

            {/* Prompt */}
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Prompt</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500"
                    placeholder="Describe what you want..."
                />
            </div>

            {/* Configs */}
            <div className="grid grid-cols-2 gap-4">
                {activeTab !== 'edit-image' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Aspect Ratio</label>
                        <select 
                            value={aspectRatio} 
                            onChange={(e) => setAspectRatio(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                        >
                            {activeTab === 'gen-video' ? (
                                <>
                                    <option value="16:9">16:9 (Landscape)</option>
                                    <option value="9:16">9:16 (Portrait)</option>
                                </>
                            ) : (
                                <>
                                    <option value="1:1">1:1</option>
                                    <option value="16:9">16:9</option>
                                    <option value="9:16">9:16</option>
                                    <option value="4:3">4:3</option>
                                    <option value="3:4">3:4</option>
                                </>
                            )}
                        </select>
                    </div>
                )}
                
                {activeTab === 'gen-image' && (
                     <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Size</label>
                        <select 
                            value={imageSize} 
                            onChange={(e) => setImageSize(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                        >
                            <option value="1K">1K</option>
                            <option value="2K">2K</option>
                            <option value="4K">4K</option>
                        </select>
                    </div>
                )}
            </div>

            <button
                onClick={() => {
                    if (activeTab === 'gen-image') generateImage();
                    else if (activeTab === 'edit-image') editImage();
                    else generateVideo();
                }}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all"
            >
                {loading ? 'Generating...' : 'Create'}
            </button>
            {activeTab !== 'edit-image' && <p className="text-xs text-slate-500 text-center">Requires Paid API Key Selection</p>}
        </div>

        {/* Result */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-center p-4 min-h-[400px]">
            {loading ? (
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-slate-400 animate-pulse">
                        {activeTab === 'gen-video' ? 'Generating video (this may take a minute)...' : 'Creating masterpiece...'}
                    </p>
                </div>
            ) : result ? (
                <div className="relative w-full h-full flex items-center justify-center">
                    {result.type === 'video' ? (
                         <video controls className="max-w-full max-h-[600px] rounded-lg shadow-2xl" src={result.url} />
                    ) : (
                         <img src={result.url} alt="Generated" className="max-w-full max-h-[600px] rounded-lg shadow-2xl" />
                    )}
                </div>
            ) : (
                <div className="text-slate-500 text-center">
                    <p>Output will appear here</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default CreativeStudio;