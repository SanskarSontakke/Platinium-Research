
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ProjectData, CanvasData, Attachment, AppSettings, ChatMessage, Table } from '../types';
import { AgentOrchestrator } from '../services/agent/orchestrator';
import { ChatMessage as ChatMessageComp } from './ChatMessage';
import { CanvasBoard } from './CanvasBoard';
import { SpreadsheetView } from './SpreadsheetView';
import AssetStudio from './AssetStudio';
import { MarkdownEditor } from './MarkdownEditor';
import { transcribeAudio, generateSpeech } from '../services/geminiService';
import { DriveService } from '../services/driveService';
import { 
  FileText, Globe, BrainCircuit, Settings2, PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose,
  RefreshCw, ArrowRight, Grid, ImagePlus, Mic, Square, Volume2, VolumeX, Loader2, X, Check, Save, History, Clock
} from 'lucide-react';

type ViewMode = 'draft' | 'canvas' | 'tables' | 'browser' | 'assets';

interface ResearchWriteViewProps {
  project: ProjectData;
}

const ResearchWriteView: React.FC<ResearchWriteViewProps> = ({ project }) => {
  const [activeView, setActiveView] = useState<ViewMode>('draft');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isChatCollapsed, setChatCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // App Settings State (Persisted in Metadata)
  const [appSettings, setAppSettings] = useState<AppSettings>(project.files.meta.content.settings || {
      imageGenerationMode: 'generate',
      imageModel: 'gemini-2.5-flash-image',
      chatPosition: 'right',
      confirmAutoWrite: true,
      confirmCanvas: false,
      confirmImageGen: false,
      chatContextSize: 10,
      streamResponses: false
  });

  const [draftContent, setDraftContent] = useState(project.files.draft.content);
  const [canvasData, setCanvasData] = useState<CanvasData>(project.files.canvas.content);
  const [tables, setTables] = useState<Table[]>(project.files.tables.content || []);
  const [browserUrl, setBrowserUrl] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>(project.files.meta.content.chatHistory || []);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // --- Search History State ---
  const [searchHistory, setSearchHistory] = useState<string[]>(project.files.meta.content.searchHistory || []);
  const [showHistory, setShowHistory] = useState(false);

  // --- Auto-Save State ---
  const [lastAutoSave, setLastAutoSave] = useState<number>(Date.now());
  const draftContentRef = useRef(draftContent);

  // Keep ref in sync for the interval closure
  useEffect(() => {
      draftContentRef.current = draftContent;
  }, [draftContent]);

  // Auto-Save Interval (Every 2 minutes)
  useEffect(() => {
      const AUTOSAVE_INTERVAL = 2 * 60 * 1000; // 2 minutes
      
      const intervalId = setInterval(async () => {
          if (project.files.draft.id) {
              try {
                  await DriveService.saveDraft(project.files.draft.id, draftContentRef.current);
                  setLastAutoSave(Date.now());
                  console.debug('[AutoSave] Draft saved successfully');
              } catch (e) {
                  console.error('[AutoSave] Failed to save draft', e);
              }
          }
      }, AUTOSAVE_INTERVAL);

      return () => clearInterval(intervalId);
  }, [project.files.draft.id]);

  // --- Voice Engine State ---
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const playbackNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const orchestratorRef = useRef<AgentOrchestrator | null>(null);

  // --- Settings Management ---
  const updateSettings = async (newSettings: Partial<AppSettings>) => {
      const updated = { ...appSettings, ...newSettings };
      setAppSettings(updated);
      
      // Persist to Drive
      const meta = project.files.meta.content;
      meta.settings = updated;
      // We perform this silently without blocking UI
      DriveService.saveMetadata(project.files.meta.id, meta).catch(err => console.error("Failed to save settings", err));
  };

  const addToHistory = (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      
      setSearchHistory(prev => {
          const newHistory = [trimmed, ...prev.filter(h => h !== trimmed)].slice(0, 10);
          
          // Persist to Metadata
          const meta = project.files.meta.content;
          meta.searchHistory = newHistory;
          DriveService.saveMetadata(project.files.meta.id, meta).catch(e => console.error("Failed to save history", e));
          
          return newHistory;
      });
  };

  useEffect(() => {
    orchestratorRef.current = new AgentOrchestrator(
        process.env.API_KEY || '',
        messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })).slice(-(appSettings.chatContextSize || 10)), 
        {
            projectId: project.id,
            assetsFolderId: project.assetsFolderId,
            draftContent,
            canvasData,
            customSources: [],
            enabledTools: ['readProjectContext', 'searchWeb', 'deepReason', 'updateDraft', 'citeSources', 'generateCanvas', 'analyzeImage', 'searchYouTube', 'readWebPage', 'generateImage', 'manageTables'],
            currentBrowserUrl: browserUrl,
            // @ts-ignore
            tables: tables,
            // Pass settings to Agent Context
            imageModel: appSettings.imageModel,
            imageGenerationMode: appSettings.imageGenerationMode
        }
     );
  }, [draftContent, canvasData, tables, browserUrl, project.id, messages.length, appSettings]); 

  const playAudioResponse = async (base64: string) => {
      if (isAudioMuted) return;
      if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      if (playbackNodeRef.current) {
          try { playbackNodeRef.current.stop(); } catch(e){}
      }

      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      
      const gainNode = ctx.createGain();
      gainNode.gain.value = volume;
      gainNodeRef.current = gainNode;
      
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      source.start(0);
      playbackNodeRef.current = source;
  };

  const handleSendMessage = async (text: string, source: 'text' | 'voice' = 'text') => {
      if (!text.trim()) return;
      
      // Update Search History
      addToHistory(text);

      // Visually indicate voice messages in the chat
      const displayContent = source === 'voice' ? `🎤 ${text}` : text;
      
      const userMsg: ChatMessage = { 
          id: Date.now().toString(), 
          role: 'user', 
          content: displayContent, 
          timestamp: Date.now(), 
          attachments: attachments 
      };
      setMessages(prev => [...prev, userMsg]);
      setIsProcessing(true);
      setInputValue('');
      setAttachments([]); 

      try {
          if (!orchestratorRef.current) throw new Error("Agent not initialized");
          const responseId = (Date.now() + 1).toString();
          setMessages(prev => [...prev, { id: responseId, role: 'model', content: '', toolActivity: [], timestamp: Date.now() }]);

          // Requirement: strictly English response for voice inputs
          const finalPrompt = source === 'voice' ? `${text} (Note: Answer strictly in English language only)` : text;

          const finalResponse = await orchestratorRef.current.sendMessage(
              [{ text: finalPrompt }],
              {
                  onToolStart: (callId, toolName) => {
                      setMessages(prev => prev.map(m => m.id === responseId ? {
                          ...m,
                          toolActivity: [...(m.toolActivity || []), { id: callId, type: 'tool', label: toolName, status: 'running' }]
                      } : m));
                  },
                  onToolResult: (res) => {
                       setMessages(prev => prev.map(m => m.id === responseId ? {
                          ...m,
                          toolActivity: m.toolActivity?.map(t => t.id === res.callId ? { ...t, status: 'done', output: res.output, meta: res.meta } : t)
                      } : m));
                  },
                  onDraftUpdate: (newContent) => setDraftContent(newContent),
                  onCanvasUpdate: (newData) => setCanvasData(newData),
                  // @ts-ignore
                  onTablesUpdate: (newTables) => setTables(newTables),
                  getSessionImages: () => ({})
              }
          );
          
          setMessages(prev => prev.map(m => m.id === responseId ? { ...m, content: finalResponse } : m));

          // If source was voice, speak the response back
          if (source === 'voice' && !isAudioMuted) {
             const audioBase64 = await generateSpeech(finalResponse);
             playAudioResponse(audioBase64);
          }
      } catch (err: any) {
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `Error: ${err.message}`, isError: true, timestamp: Date.now() }]);
      } finally {
          setIsProcessing(false);
      }
  };

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;
          const recorder = new MediaRecorder(stream);
          recorderRef.current = recorder;
          audioChunksRef.current = [];
          
          recorder.ondataavailable = (e) => {
              if (e.data.size > 0) audioChunksRef.current.push(e.data);
          };

          recorder.onstop = async () => {
              const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              setIsTranscribing(true);
              const reader = new FileReader();
              reader.onloadend = async () => {
                  const base64 = (reader.result as string).split(',')[1];
                  try {
                      // BUILD ADVANCED CONTEXT
                      // 1. Recent Draft Content (last 2000 chars)
                      const draftSnippet = draftContent.length > 0 
                        ? `[DRAFT_DOCUMENT_SNIPPET]:\n...${draftContent.substring(Math.max(0, draftContent.length - 2000))}\n` 
                        : "";
                      
                      // 2. Recent Chat History (last 3 turns)
                      const recentChats = messages.slice(-6).map(m => 
                        `${m.role === 'user' ? 'USER' : 'AI'}: ${m.content.substring(0, 150)}`
                      ).join('\n');
                      const chatSnippet = recentChats ? `\n[RECENT_CONVERSATION]:\n${recentChats}` : "";

                      const combinedContext = `${draftSnippet}${chatSnippet}`.trim();

                      const text = await transcribeAudio(base64, 'audio/webm', combinedContext);
                      if (text.trim()) {
                          handleSendMessage(text, 'voice');
                      }
                  } catch (e) { console.error("Transcription failed", e); }
                  finally { setIsTranscribing(false); }
              };
              reader.readAsDataURL(blob);
              stream.getTracks().forEach(t => t.stop());
          };

          recorder.start();
          setIsRecording(true);
      } catch (e) { console.error("Mic access denied", e); }
  };

  const stopRecording = () => {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
          recorderRef.current.stop();
          setIsRecording(false);
      }
  };

  useEffect(() => {
    if (gainNodeRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(volume, audioContextRef.current?.currentTime || 0, 0.05);
    }
  }, [volume]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isChatCollapsed]);

  return (
    <div className="flex h-screen bg-[#09090b] text-white font-sans overflow-hidden">
        
        {/* --- LEFT SIDEBAR --- */}
        <div className={`flex-shrink-0 border-r border-zinc-800 bg-[#0c0c0e] flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] relative z-20 ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
             <div className="h-14 flex items-center justify-between px-4 border-b border-zinc-800">
                 {!isSidebarCollapsed && (
                    <div className="font-bold text-[10px] tracking-[0.2em] uppercase text-zinc-400 animate-fade-in">Research Deck</div>
                 )}
                 <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className={`p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors ${isSidebarCollapsed ? 'mx-auto' : ''}`}>
                     {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5"/> : <PanelLeftClose className="w-4 h-4"/>}
                 </button>
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-1.5">
                 {[
                     { id: 'draft', label: 'Draft Document', icon: FileText },
                     { id: 'canvas', label: 'Mind Map', icon: BrainCircuit },
                     { id: 'tables', label: 'Data & Charts', icon: Grid },
                     { id: 'assets', label: 'Project Assets', icon: ImagePlus },
                     { id: 'browser', label: 'Web Browser', icon: Globe },
                 ].map((item) => (
                     <button
                         key={item.id}
                         onClick={() => setActiveView(item.id as ViewMode)}
                         className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-gentle group ${activeView === item.id ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-900'} ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                         title={isSidebarCollapsed ? item.label : ''}
                     >
                         <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110 ${activeView === item.id ? 'text-cyan-400' : 'text-zinc-500'}`} />
                         {!isSidebarCollapsed && <span className="animate-fade-in whitespace-nowrap overflow-hidden text-[13px]">{item.label}</span>}
                     </button>
                 ))}
             </div>
             
             {/* Auto-Save Status Indicator */}
             <div className={`px-4 py-2 text-[10px] text-zinc-600 flex items-center gap-2 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                 <Save className="w-3 h-3" />
                 {!isSidebarCollapsed && <span>Last saved: {new Date(lastAutoSave).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
             </div>

             <div className="p-2.5 border-t border-zinc-800">
                  <button 
                    onClick={() => setShowSettings(true)}
                    className={`flex items-center gap-3 w-full p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                  >
                      <Settings2 className="w-5 h-5 flex-shrink-0"/>
                      {!isSidebarCollapsed && <span className="text-[10px] font-bold uppercase tracking-widest animate-fade-in">Settings</span>}
                  </button>
             </div>
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div className="flex-1 flex min-w-0 bg-[#000000] relative">
            <div className="flex-1 overflow-hidden relative h-full">
                <div key={activeView} className="h-full w-full animate-fade-in">
                    {activeView === 'draft' && <MarkdownEditor value={draftContent} onChange={setDraftContent} />}
                    {activeView === 'canvas' && <CanvasBoard data={canvasData} onUpdate={setCanvasData} />}
                    {activeView === 'tables' && <SpreadsheetView tables={tables} onUpdate={setTables} />}
                    {activeView === 'assets' && <AssetStudio assetsFolderId={project.assetsFolderId} />}
                </div>
            </div>

            {/* --- COLLAPSIBLE AI CHAT INTERFACE --- */}
            <div className={`flex-shrink-0 bg-[#09090b] flex flex-col relative z-30 border-l border-zinc-800 h-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isChatCollapsed ? 'w-12' : 'w-[380px] xl:w-[440px]'}`}>
                <div className="h-14 flex items-center justify-between px-3 border-b border-zinc-800/50 bg-[#09090b]/80 backdrop-blur-md shrink-0">
                    {!isChatCollapsed && (
                         <div className="flex items-center gap-3 px-3">
                            <div className={`w-1.5 h-1.5 rounded-full ${isProcessing || isRecording || isTranscribing ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]' : 'bg-zinc-700'}`} />
                            <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${isProcessing || isRecording || isTranscribing ? 'text-cyan-400' : 'text-zinc-600'}`}>
                              {isRecording ? 'Listening...' : isTranscribing ? 'Transcribing...' : isProcessing ? 'Processing...' : 'Agent Standing By'}
                            </span>
                        </div>
                    )}
                    <button onClick={() => setChatCollapsed(!isChatCollapsed)} className={`p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors ${isChatCollapsed ? 'mx-auto' : ''}`}>
                        {isChatCollapsed ? <PanelRightClose className="w-5 h-5"/> : <PanelRightOpen className="w-5 h-5"/>}
                    </button>
                </div>

                {!isChatCollapsed && (
                    <>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pt-6 pb-2 relative bg-[#050505] space-y-4">
                            {messages.map((msg) => (
                                <ChatMessageComp key={msg.id} msg={msg} />
                            ))}
                            <div ref={messagesEndRef} className="h-4" />
                        </div>

                        <div className="p-4 bg-[#09090b] relative border-t border-zinc-800/50">
                            
                            {/* History Popover */}
                            {showHistory && searchHistory.length > 0 && (
                                <div className="absolute bottom-full left-4 mb-2 w-72 bg-[#121214] border border-zinc-800 rounded-xl shadow-2xl p-2 z-50 animate-fade-in-up">
                                    <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-white/5">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-zinc-500"/>
                                            <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Recent Queries</span>
                                        </div>
                                        <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-zinc-800 rounded"><X className="w-3 h-3 text-zinc-500 hover:text-white"/></button>
                                    </div>
                                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
                                        {searchHistory.map((query, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => { setInputValue(query); setShowHistory(false); }}
                                                className="text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 px-3 py-2 rounded-lg truncate transition-colors border border-transparent hover:border-zinc-700/50"
                                                title={query}
                                            >
                                                {query}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="relative group bg-[#121214] p-2 rounded-xl border border-zinc-800 focus-within:border-zinc-700 transition-all shadow-lg">
                                <textarea
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(inputValue); } }}
                                    placeholder="Ask Platinium..."
                                    className="w-full bg-transparent border-none focus:ring-0 text-[13px] text-zinc-200 placeholder:text-zinc-600 resize-none min-h-[40px] max-h-48 py-2 px-3 transition-opacity"
                                    rows={1}
                                />
                                <div className="flex items-center justify-between px-1 pb-1 mt-1">
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={isRecording ? stopRecording : startRecording} 
                                            className={`p-1.5 rounded-lg transition-all ${isRecording ? 'text-red-500 bg-red-950/20 animate-pulse' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                                            title={isRecording ? "Stop Recording" : "Voice Message"}
                                        >
                                            {isRecording ? <Square className="w-4 h-4 fill-current"/> : isTranscribing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Mic className="w-4 h-4"/>}
                                        </button>
                                        <button 
                                            onClick={() => setIsAudioMuted(!isAudioMuted)} 
                                            className={`p-1.5 rounded-lg transition-all ${isAudioMuted ? 'text-amber-500' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                                            title={isAudioMuted ? "Audio Unmute" : "Audio Mute"}
                                        >
                                            {isAudioMuted ? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}
                                        </button>
                                        <button 
                                            onClick={() => setShowHistory(!showHistory)} 
                                            className={`p-1.5 rounded-lg transition-all ${showHistory ? 'text-cyan-400 bg-cyan-950/20' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                                            title="Search History"
                                        >
                                            <History className="w-4 h-4"/>
                                        </button>
                                    </div>
                                    <button 
                                        onClick={() => handleSendMessage(inputValue)}
                                        disabled={!inputValue.trim() || isProcessing}
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${!inputValue.trim() || isProcessing ? 'bg-zinc-800 text-zinc-700' : 'bg-white text-black hover:bg-zinc-200 active:scale-95'}`}
                                    >
                                        {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <ArrowRight className="w-3.5 h-3.5 font-bold"/>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>

        {/* --- SETTINGS MODAL --- */}
        {showSettings && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="w-full max-w-md bg-[#09090b] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                    <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-zinc-400"/> Project Settings
                        </h3>
                        <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
                    </div>
                    <div className="p-6 space-y-8">
                        {/* Image Generation Section */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Image Generation</h4>
                            
                            <div className="space-y-3">
                                <label className="text-sm text-zinc-300 font-medium">Operation Mode</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => updateSettings({ imageGenerationMode: 'generate' })}
                                        className={`px-4 py-3 rounded-xl border text-xs font-bold uppercase tracking-wide transition-all ${appSettings.imageGenerationMode === 'generate' ? 'bg-cyan-950/30 border-cyan-500/50 text-cyan-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                                    >
                                        Generate Images
                                    </button>
                                    <button 
                                        onClick={() => updateSettings({ imageGenerationMode: 'prompt_only' })}
                                        className={`px-4 py-3 rounded-xl border text-xs font-bold uppercase tracking-wide transition-all ${appSettings.imageGenerationMode === 'prompt_only' ? 'bg-purple-950/30 border-purple-500/50 text-purple-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                                    >
                                        Prompts Only
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm text-zinc-300 font-medium">Model Selection</label>
                                <div className="flex flex-col gap-2">
                                     <button 
                                        onClick={() => updateSettings({ imageModel: 'gemini-2.5-flash-image' })}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${appSettings.imageModel === 'gemini-2.5-flash-image' ? 'bg-zinc-800 border-white/20 text-white' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:bg-zinc-900'}`}
                                    >
                                        <span className="text-sm font-medium">Gemini 2.5 Flash (Standard)</span>
                                        {appSettings.imageModel === 'gemini-2.5-flash-image' && <Check className="w-4 h-4 text-cyan-400"/>}
                                    </button>
                                     <button 
                                        onClick={() => updateSettings({ imageModel: 'imagen-4.0-generate-001' })}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${appSettings.imageModel === 'imagen-4.0-generate-001' ? 'bg-zinc-800 border-white/20 text-white' : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:bg-zinc-900'}`}
                                    >
                                        <span className="text-sm font-medium">Imagen 3 (High Quality)</span>
                                        {appSettings.imageModel === 'imagen-4.0-generate-001' && <Check className="w-4 h-4 text-purple-400"/>}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Chat Intelligence Section */}
                        <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Chat Intelligence</h4>
                            
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm text-zinc-300 font-medium">Context Memory (Messages)</label>
                                    <span className="text-xs font-mono text-cyan-400">{appSettings.chatContextSize || 10} msgs</span>
                                </div>
                                <input 
                                    type="range" min="1" max="50" step="1"
                                    value={appSettings.chatContextSize || 10}
                                    onChange={(e) => updateSettings({ chatContextSize: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-cyan-400"
                                />
                                <p className="text-[10px] text-zinc-600">Higher values allow the agent to remember more history but cost more tokens.</p>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-zinc-200">Stream Responses</span>
                                    <span className="text-[10px] text-zinc-500">Typewriter effect for messages</span>
                                </div>
                                <button 
                                    onClick={() => updateSettings({ streamResponses: !(appSettings.streamResponses ?? false) })}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${appSettings.streamResponses ? 'bg-cyan-500' : 'bg-zinc-700'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${appSettings.streamResponses ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 bg-zinc-900/50 border-t border-zinc-800">
                        <button onClick={() => setShowSettings(false)} className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-zinc-200 transition-colors">Done</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ResearchWriteView;
