import React, { useState } from 'react';
import { Search, Video, FileText, MessageSquare, PenTool, LayoutGrid, Globe, ArrowRight, AlertCircle, Loader2, Server, Download, CloudLightning, Bot, Info, Mic } from 'lucide-react';
import Timeline from './components/Timeline';
import HighlightList from './components/HighlightList';
import ChatInterface from './components/ChatInterface';
import { TabOption, VideoData, TranscriptSegment } from './types';
import { initializeChat } from './services/geminiService';
import { analyzeVideo } from './services/api';

function App() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [dataSource, setDataSource] = useState<'backend' | 'ai-simulated'>('ai-simulated');
  const [activeTab, setActiveTab] = useState<TabOption>(TabOption.TRANSCRIPT);
  const [currentTime, setCurrentTime] = useState(0);

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    
    setError(null);
    setVideoData(null);
    setIsLoading(true);
    setLoadingStep("Connecting to analysis service...");

    // We can't easily stream granular progress from the fetch call in this simple setup,
    // so we set a timeout to change the message to keep user engaged if it takes long (downloading audio).
    const loadingTimer = setTimeout(() => {
        setLoadingStep("Downloading audio & Transcribing (this may take 30s)...");
    }, 2000);

    try {
      const result = await analyzeVideo(url);
      setVideoData(result.data);
      setDataSource(result.source);
      initializeChat(result.data.transcript);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please check the URL.");
    } finally {
      clearTimeout(loadingTimer);
      setIsLoading(false);
    }
  };

  const handleLucky = () => {
      setUrl("https://www.bilibili.com/video/BV1J4411C76B"); 
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
  };

  const handleDownloadTranscript = () => {
    if (!videoData) return;
    const content = videoData.transcript.map(t => `${t.timestamp} - ${t.text}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = `${videoData.bvid}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(u);
  };

  if (!videoData && !isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white relative overflow-hidden">
        <div className="absolute top-6 right-6 z-10">
            <button className="bg-black text-white px-6 py-2 rounded-full font-medium text-sm hover:bg-gray-800 transition">Sign In</button>
        </div>
        
        <div className="text-center max-w-2xl w-full space-y-8 relative z-10">
            <div className="flex justify-center mb-6">
                 <div className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                    <Video className="text-blue-600" size={32} />
                    <span>BiliCut</span>
                 </div>
            </div>
            
            <div className="space-y-2">
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">The best way to learn from Bilibili.</h1>
                <p className="text-gray-500">Extract highlights, real subtitles, and chat with AI.</p>
            </div>

            <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search className="text-gray-400" size={20} />
                </div>
                <input 
                    type="text" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    placeholder="Paste Bilibili URL (e.g. https://www.bilibili.com/video/BV1...)"
                    className="w-full py-4 pl-12 pr-32 bg-gray-50 border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all text-gray-800 placeholder-gray-400"
                />
                <div className="absolute inset-y-2 right-2 flex items-center gap-2">
                    <button 
                        onClick={handleLucky}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition shadow-sm flex items-center gap-1"
                    >
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-xl text-sm text-left">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-lg shadow-gray-100/50 flex items-center gap-6 text-left max-w-lg mx-auto transform transition hover:-translate-y-1 duration-300">
                 <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex-shrink-0 opacity-80 blur-sm absolute"></div>
                 <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex-shrink-0 relative z-10 flex items-center justify-center text-white">
                    <Server size={32} />
                 </div>
                 <div>
                    <h3 className="font-semibold text-gray-900">Hybrid Architecture</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Checks for official subtitles first. If missing, it downloads audio and uses <strong>Gemini 1.5 Flash</strong> to accurately transcribe the video content.
                    </p>
                 </div>
            </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={24} className="text-blue-600 animate-pulse" />
                </div>
            </div>
            <h2 className="text-gray-900 font-medium mt-6 text-lg">Analyzing Video</h2>
            <p className="text-gray-500 text-sm mt-2 animate-pulse">{loadingStep}</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col h-screen overflow-hidden">
        {/* Navbar */}
        <nav className="h-16 px-6 bg-white border-b border-gray-100 flex items-center justify-between flex-shrink-0 z-20">
            <div className="flex items-center gap-2 text-gray-900 font-bold text-xl cursor-pointer" onClick={() => setVideoData(null)}>
                <Video className="text-blue-600" />
                <span>BiliCut</span>
            </div>
            <div className="flex items-center gap-4">
                 <div className={`hidden md:flex items-center text-xs px-3 py-1 rounded-full border ${
                     dataSource === 'backend' 
                     ? 'bg-green-50 text-green-700 border-green-200' 
                     : 'bg-orange-50 text-orange-700 border-orange-200'
                 }`}>
                    {dataSource === 'backend' ? (
                        <>
                            <Server size={12} className="mr-2" />
                            Backend Connected
                        </>
                    ) : (
                        <>
                            <CloudLightning size={12} className="mr-2" />
                            Client Mode
                        </>
                    )}
                 </div>
                <button className="bg-black text-white px-5 py-1.5 rounded-full text-sm font-medium hover:bg-gray-800">Sign In</button>
            </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* Left Section: Video & Highlights */}
            <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar">
                
                {/* Video Player Container */}
                <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-sm relative group">
                    <iframe
                        id="bili-player"
                        src={`//player.bilibili.com/player.html?bvid=${videoData?.bvid}&page=1&high_quality=1&danmaku=0&t=${currentTime}`}
                        className="w-full h-full"
                        scrolling="no"
                        frameBorder="0"
                        allowFullScreen
                    ></iframe>
                </div>

                {/* Video Meta & Controls */}
                <div className="mt-6">
                     <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-gray-900 line-clamp-1">{videoData?.title}</h2>
                                {videoData?.category && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded">{videoData.category}</span>}
                            </div>
                            <p className="text-sm text-gray-500 mt-1">Author: {videoData?.author}</p>
                        </div>
                     </div>

                    {/* Colored Timeline */}
                    <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100/50">
                        {videoData && (
                            <Timeline 
                                duration={videoData.duration} 
                                highlights={videoData.highlights} 
                                onSeek={handleSeek} 
                            />
                        )}
                    </div>

                    {/* Highlight List */}
                    <div className="mt-6 bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
                         {videoData && <HighlightList highlights={videoData.highlights} onSeek={handleSeek} />}
                    </div>
                </div>
            </div>

            {/* Right Section: Sidebar (Transcript/Chat/Notes) */}
            <div className="w-[400px] bg-white border-l border-gray-100 flex flex-col h-full shadow-[0_0_40px_-10px_rgba(0,0,0,0.05)] z-10">
                
                {/* Sidebar Tabs */}
                <div className="flex items-center p-2 gap-1 border-b border-gray-50 m-2 bg-gray-50/50 rounded-xl">
                    {[TabOption.TRANSCRIPT, TabOption.CHAT, TabOption.NOTES].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                                activeTab === tab 
                                ? 'bg-white text-blue-600 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                            }`}
                        >
                            {tab === TabOption.TRANSCRIPT && <FileText size={16} />}
                            {tab === TabOption.CHAT && <MessageSquare size={16} />}
                            {tab === TabOption.NOTES && <PenTool size={16} />}
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Sidebar Content */}
                <div className="flex-1 overflow-hidden p-4 relative">
                    {activeTab === TabOption.TRANSCRIPT && videoData && (
                        <div className="h-full overflow-y-auto custom-scrollbar pr-2 space-y-6">
                             {/* Tools Row */}
                             <div className="flex items-center justify-between mb-4 sticky top-0 bg-white/90 backdrop-blur-sm py-2 z-10">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${
                                        videoData.isTranscriptSimulated ? 'bg-amber-400' :
                                        videoData.isAiTranscribed ? 'bg-purple-500' : 
                                        'bg-green-400'
                                    }`}></span>
                                    <Search size={14} className="text-gray-400"/>
                                    {videoData.isAiTranscribed && (
                                        <span className="text-[10px] bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                                            AI Transcribed
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleDownloadTranscript}
                                        className="flex items-center gap-1 px-3 py-1 border border-gray-200 text-gray-600 text-xs rounded-full hover:bg-gray-50 transition-colors"
                                        title="Download Transcript"
                                    >
                                        <Download size={12} />
                                        Export
                                    </button>
                                </div>
                             </div>
                             
                             {/* Status Banners */}
                             {videoData.isTranscriptSimulated && (
                                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
                                    <Bot size={14} className="mt-0.5 flex-shrink-0" />
                                    <p>Official subtitles unavailable. This transcript is a simulation generated by AI based on video metadata.</p>
                                </div>
                             )}

                             {videoData.isAiTranscribed && (
                                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs text-purple-800 flex items-start gap-2">
                                    <Mic size={14} className="mt-0.5 flex-shrink-0" />
                                    <p>No official subtitles found. This transcript was generated by AI listening to the video audio.</p>
                                </div>
                             )}

                             <div className="space-y-6">
                                {videoData.transcript.length > 0 ? (
                                    videoData.transcript.map((item) => (
                                        <div key={item.id} className="group hover:bg-blue-50/50 p-2 rounded-lg -mx-2 transition-colors cursor-pointer" onClick={() => handleSeek(item.startTime)}>
                                            <div className="flex gap-3">
                                                <span className={`text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity mt-1 ${
                                                    videoData.isTranscriptSimulated ? 'text-amber-500' : 
                                                    videoData.isAiTranscribed ? 'text-purple-500' :
                                                    'text-blue-500'
                                                }`}>{item.timestamp}</span>
                                                <p className="text-sm text-gray-600 leading-relaxed font-light">{item.text}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-gray-400 text-sm mt-10">
                                        No transcript available.
                                    </div>
                                )}
                             </div>
                        </div>
                    )}

                    {activeTab === TabOption.CHAT && videoData && (
                        <ChatInterface videoTitle={videoData.title} />
                    )}

                    {activeTab === TabOption.NOTES && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                             <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                                <PenTool className="text-gray-400" size={24} />
                             </div>
                            <h3 className="font-semibold text-gray-900 mb-2">Sign in to save notes</h3>
                            <p className="text-sm text-gray-500 mb-6 max-w-[200px]">Highlight transcript moments and keep your takeaways in one place.</p>
                            <button className="bg-black text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-gray-800 transition shadow-lg shadow-gray-200">
                                Sign in to save notes
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
}

export default App;