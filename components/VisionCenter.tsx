import React, { useState } from 'react';
import { getGeminiClient } from '../services/geminiService';
import { Model } from '../types';
import { blobToBase64 } from '../utils/audio';

const VisionCenter: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
        const client = getGeminiClient();
        const base64 = await blobToBase64(file);
        
        // Determine prompt based on input or default
        const query = prompt || (file.type.startsWith('video') ? "Analyze this video and describe key events." : "Analyze this image in detail.");
        
        const response = await client.models.generateContent({
            model: Model.PRO, // Gemini 3 Pro for understanding
            contents: {
                parts: [
                    { inlineData: { mimeType: file.type, data: base64 } },
                    { text: query }
                ]
            }
        });
        
        setResult(response.text || "No analysis returned.");
    } catch (e: any) {
        setResult("Error: " + e.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
       <div className="w-full md:w-1/2 space-y-6">
           <div className="bg-slate-800 p-6 rounded-xl space-y-4">
               <h2 className="text-xl font-bold mb-4">Vision Analysis</h2>
               
               <div>
                   <label className="block text-sm font-medium text-slate-400 mb-2">Upload Image or Video</label>
                   <input 
                        type="file" 
                        accept="image/*,video/*"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-green-600 file:text-white file:border-0 hover:file:bg-green-700"
                   />
               </div>
               
               <div>
                   <label className="block text-sm font-medium text-slate-400 mb-2">Question (Optional)</label>
                   <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="What is happening in this?"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-green-500"
                        rows={3}
                   />
               </div>

               <button
                    onClick={handleAnalyze}
                    disabled={loading || !file}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all"
               >
                   {loading ? 'Analyzing...' : 'Analyze Media'}
               </button>
           </div>
       </div>

       <div className="w-full md:w-1/2 bg-slate-800 rounded-xl p-6 border border-slate-700 overflow-y-auto">
           <h3 className="text-lg font-semibold mb-4 text-green-400">Analysis Result</h3>
           {result ? (
               <div className="prose prose-invert max-w-none">
                   <div className="whitespace-pre-wrap">{result}</div>
               </div>
           ) : (
               <div className="text-slate-500 italic">Results will appear here...</div>
           )}
       </div>
    </div>
  );
};

export default VisionCenter;