export enum Model {
  // Text & General
  FLASH = 'gemini-2.5-flash',
  FLASH_LITE = 'gemini-flash-lite-latest',
  PRO = 'gemini-3-pro-preview',
  
  // Vision
  FLASH_IMAGE = 'gemini-2.5-flash-image', // Editing & Standard Gen
  PRO_IMAGE = 'gemini-3-pro-image-preview', // High Quality Gen
  
  // Video
  VEO_FAST = 'veo-3.1-fast-generate-preview',
  
  // Audio
  AUDIO_LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025',
  TTS = 'gemini-2.5-flash-preview-tts',
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  grounding?: {
    search?: Array<{ uri: string; title: string }>;
    maps?: Array<{ uri: string; title: string }>;
  };
}

export interface GeneratedMedia {
  type: 'image' | 'video' | 'audio';
  url: string;
  mimeType: string;
}
