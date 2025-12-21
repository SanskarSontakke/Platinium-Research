
import React, { useState, useRef, useEffect } from 'react';
import { ProjectData, CanvasData, Attachment, AppSettings, ChatMessage, Table } from '../types';
import { DriveService } from '../services/driveService';
import { AgentOrchestrator } from '../services/agent/orchestrator';
import { ChatMessage as ChatMessageComp } from './ChatMessage';
import { CanvasBoard } from './CanvasBoard';
import { SpreadsheetView } from './SpreadsheetView';
import AssetStudio from './AssetStudio';
import { MarkdownEditor } from './MarkdownEditor';
import LiveBrainstorm from './LiveBrainstorm';
import { 
  FileText, Globe, BrainCircuit, Waves, Settings2, PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose,
  RefreshCw, ArrowRight, Grid, ImagePlus
} from 'lucide-react';

type ViewMode = 'draft' | 'canvas' | 'tables' | 'browser' | 'assets' | 'brainstorm';

interface ResearchWriteViewProps {
  project: ProjectData;
}

const ResearchWriteView: React.FC<ResearchWriteViewProps> = ({ project }) => {
  const [activeView, setActiveView] = useState<ViewMode>('draft');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isChatCollapsed, setChatCollapsed] = useState(false);
  
  const [draftContent, setDraftContent] = useState(project.files.draft.content);
  const [canvasData, setCanvasData] = useState<CanvasData>(project.files.canvas.content);
  const [tables, setTables] = useState<Table[]>(project.files.tables.content || []);
  const [browserUrl, setBrowserUrl] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>(project.files.meta.content.chatHistory || []);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Lifted state for Live Brainstorm to ensure persistence
  const [liveHistory, setLiveHistory] = useState<{ role: 'user' | 'ai', text: string, id: number }[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const orchestratorRef = useRef<AgentOrchestrator | null>(null);

  useEffect(() => {
    orchestratorRef.current = new AgentOrchestrator(
        process.env.API_KEY || '',
        messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })).slice(-10), 
        {
            projectId: project.id,
            assetsFolderId: project.assetsFolderId,
            draftContent,
            canvasData,
            customSources: [],
            enabledTools: ['readProjectContext', 'searchWeb', 'deepReason', 'updateDraft', 'citeSources', 'generateCanvas', 'analyzeImage', 'searchYouTube', 'readWebPage', 'generateImage', 'manageTables'],
            currentBrowserUrl: browserUrl,
            // @ts-ignore
            tables: tables
        }
     );
  }, [draftContent, canvasData, tables, browserUrl, project.id, messages.length]); 

  const handleSendMessage = async (text: string) => {
      if (!text.trim()) return;
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now(), attachments: attachments };
      setMessages(prev => [...prev, userMsg]);
      setIsProcessing(true);
      setInputValue('');
      setAttachments([]); 

      try {
          if (!orchestratorRef.current) throw new Error("Agent not initialized");
          const responseId = (Date.now() + 1).toString();
          setMessages(prev => [...prev, { id: responseId, role: 'model', content: '', toolActivity: [], timestamp: Date.now() }]);

          const finalResponse = await orchestratorRef.current.sendMessage(
              [{ text }],
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
      } catch (err: any) {
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `Error: ${err.message}`, isError: true, timestamp: Date.now() }]);
      } finally {
          setIsProcessing(false);
      }
  };

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
                     { id: 'brainstorm', label: 'Live Brainstorm', icon: Waves },
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
             <div className="p-2.5 border-t border-zinc-800">
                  <button className={`flex items-center gap-3 w-full p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
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
                    {activeView === 'brainstorm' && (
                      <LiveBrainstorm 
                        projectContext={{
                          projectId: project.id,
                          assetsFolderId: project.assetsFolderId,
                          draftContent,
                          canvasData,
                          tables
                        }}
                        history={liveHistory}
                        onUpdateHistory={setLiveHistory}
                        onDraftUpdate={setDraftContent}
                        onCanvasUpdate={setCanvasData}
                        onTablesUpdate={setTables}
                      />
                    )}
                </div>
            </div>

            {/* --- COLLAPSIBLE AI CHAT INTERFACE --- */}
            <div className={`flex-shrink-0 bg-[#09090b] flex flex-col relative z-30 border-l border-zinc-800 h-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isChatCollapsed ? 'w-12' : 'w-[380px] xl:w-[440px]'}`}>
                <div className="h-14 flex items-center justify-between px-3 border-b border-zinc-800/50 bg-[#09090b]/80 backdrop-blur-md shrink-0">
                    {!isChatCollapsed && (
                         <div className="flex items-center gap-3 px-3">
                            <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]' : 'bg-zinc-700'}`} />
                            <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${isProcessing ? 'text-cyan-400' : 'text-zinc-600'}`}>Agent Standing By</span>
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

                        <div className="p-4 bg-[#09090b] relative">
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
                                    <button onClick={() => setActiveView('brainstorm')} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all" title="Live Brainstorm">
                                        <Waves className="w-4 h-4"/>
                                    </button>
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
    </div>
  );
};

export default ResearchWriteView;
