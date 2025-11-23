import React, { useState } from 'react';
import UniversalChat from './components/UniversalChat';
import CreativeStudio from './components/CreativeStudio';
import AudioLab from './components/AudioLab';
import VisionCenter from './components/VisionCenter';

// Icons as SVG components to avoid dependencies
const ChatIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>;
const CreativeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>;
const AudioIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>;
const VisionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>;

type View = 'chat' | 'creative' | 'audio' | 'vision';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('chat');

  const renderContent = () => {
    switch (activeView) {
      case 'chat': return <UniversalChat />;
      case 'creative': return <CreativeStudio />;
      case 'audio': return <AudioLab />;
      case 'vision': return <VisionCenter />;
      default: return <UniversalChat />;
    }
  };

  const NavButton = ({ view, icon, label }: { view: View; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setActiveView(view)}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all ${
        activeView === view 
          ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
           <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg"></div>
           <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
             OmniGen
           </h1>
        </div>
        
        <nav className="space-y-2 flex-1">
          <NavButton view="chat" icon={<ChatIcon />} label="Chat & Knowledge" />
          <NavButton view="creative" icon={<CreativeIcon />} label="Creative Studio" />
          <NavButton view="audio" icon={<AudioIcon />} label="Audio Lab" />
          <NavButton view="vision" icon={<VisionIcon />} label="Vision Center" />
        </nav>

        <div className="text-xs text-slate-600 px-2 mt-4 text-center">
          Powered by Gemini 2.5 & 3.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 h-full overflow-hidden relative">
        <div className="h-full max-w-7xl mx-auto">
             {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;