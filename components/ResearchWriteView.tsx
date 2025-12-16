
import React, { useState, useRef, useEffect } from 'react';
import { ProjectData, CanvasData, Attachment, AppSettings, ChatMessage, Table } from '../types';
import { DriveService } from '../services/driveService';
import { AgentOrchestrator } from '../services/agent/orchestrator';
import { refinePrompt } from '../services/geminiService';
import { ChatMessage as ChatMessageComp } from './ChatMessage';
import { CanvasBoard } from './CanvasBoard';
import { SpreadsheetView } from './SpreadsheetView';
import AssetStudio from './AssetStudio';
import { DrivePicker } from './DrivePicker';
import { MarkdownEditor } from './MarkdownEditor';
import { Logo } from './Logo';
import { marked } from 'marked';
import { 
  FileText, Box, Globe, Image as ImageIcon, 
  Search, BrainCircuit, Youtube, Mic, ChevronRight, ChevronDown, 
  X, Plus, ExternalLink, RefreshCw, Undo2, 
  AlertCircle, CheckCircle2, ArrowLeft, ArrowRight, ArrowDown,
  Files, Bot, Settings2, RotateCw, Layout, BookOpen, PenTool, Sparkles,
  Zap, Eye, Menu, PanelLeftClose, PanelLeftOpen, EyeOff, ScanEye, ImagePlus, FolderOpen, Quote,
  Trash2, Compass, Link as LinkIcon, HardDrive, Upload, Wand2, Printer, Download, Share2, Grid, Key,
  CreditCard, Sidebar, Dock
} from 'lucide-react';

// --- Types ---

type ViewMode = 'draft' | 'canvas' | 'tables' | 'browser' | 'assets';

interface SaveState {
  status: 'synced' | 'saving' | 'error' | 'conflict';
  lastSaved: number;
  canUndo: boolean;
}

interface ResearchWriteViewProps {
  project: ProjectData;
}

// --- Browser Component ---
const BrowserPanel: React.FC<{ 
  url: string; 
  onUrlChange: (url: string) => void; 
}> = ({ url, onUrlChange }) => {
  const [inputUrl, setInputUrl] = useState(url);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => { setInputUrl(url); }, [url]);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl;
    if (!target.trim()) return;
    if (!target.startsWith('http')) target = `https://${target}`;
    onUrlChange(target);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="flex items-center gap-2 p-2 bg-[#252526] border-b border-[#333]">
        <div className="flex gap-1">
            <button className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-700"><ArrowLeft className="w-4 h-4" /></button>
            <button className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-700"><ArrowRight className="w-4 h-4" /></button>
            <button className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-700" onClick={() => iframeRef.current && (iframeRef.current.src = iframeRef.current.src)}><RotateCw className="w-3 h-3" /></button>
        </div>
        <form onSubmit={handleNavigate} className="flex-1">
          <input 
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="w-full bg-[#3c3c3c] text-zinc-200 text-xs px-3 py-1.5 rounded-sm border border-transparent focus:border-cyan-700 focus:outline-none placeholder:text-zinc-500 font-mono"
            placeholder="Enter URL (e.g. wikipedia.org)"
          />
        </form>
        <a href={url} target="_blank" rel="noopener noreferrer" className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-700"><ExternalLink className="w-4 h-4" /></a>
      </div>
      <div className="flex-1 relative bg-[#1e1e1e]">
         {url ? (
            <iframe ref={iframeRef} src={url} className="w-full h-full bg-white" sandbox="allow-same-origin allow-scripts allow-forms" title="Browser" />
         ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <Globe className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-sm">Enter a URL to browse</p>
                <div className="flex gap-2 mt-4">
                   <button onClick={() => onUrlChange('https://www.wikipedia.org')} className="text-xs bg-zinc-800 px-3 py-1 rounded hover:text-white">Wikipedia</button>
                   <button onClick={() => onUrlChange('https://arxiv.org')} className="text-xs bg-zinc-800 px-3 py-1 rounded hover:text-white">ArXiv</button>
                </div>
            </div>
         )}
         {url && <div className="absolute bottom-0 left-0 right-0 bg-[#252526] border-t border-[#333] p-1.5 flex items-center justify-center gap-2 text-[10px] text-amber-500/80 z-10"><AlertCircle className="w-3 h-3" /><span>Note: Some websites block embedding. Use 'Open Externally' if blank.</span></div>}
      </div>
    </div>
  );
};

// --- Settings Modal ---
const SettingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onUpdate: (s: AppSettings) => void;
}> = ({ isOpen, onClose, settings, onUpdate }) => {
    
    const handleSelectKey = async () => {
        try {
            await (window as any).aistudio.openSelectKey();
            alert("API Key updated successfully.");
        } catch (e) {
            console.error(e);
            alert("Failed to open key selector.");
        }
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-[450px] bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50">
                    <span className="text-xs font-bold uppercase tracking-widest text-white">System Settings</span>
                    <button onClick={onClose}><X className="w-4 h-4 text-zinc-500 hover:text-white"/></button>
                </div>
                <div className="p-6 space-y-8">
                    
                    {/* Chat Position */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Chat Interface</label>
                        <div className="flex gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                             <button 
                                onClick={() => onUpdate({...settings, chatPosition: 'bottom'})}
                                className={`flex-1 py-2 text-xs font-bold uppercase rounded-md transition-all flex items-center justify-center gap-2 ${settings.chatPosition === 'bottom' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                             >
                                 <Dock className="w-3.5 h-3.5" /> Bottom
                             </button>
                             <button 
                                onClick={() => onUpdate({...settings, chatPosition: 'right'})}
                                className={`flex-1 py-2 text-xs font-bold uppercase rounded-md transition-all flex items-center justify-center gap-2 ${settings.chatPosition === 'right' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                             >
                                 <Sidebar className="w-3.5 h-3.5" /> Right
                             </button>
                        </div>
                    </div>

                    <div className="h-px bg-zinc-800 w-full"/>

                    {/* Image Generation Mode */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Image Strategy</label>
                        <div className="flex gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                             <button 
                                onClick={() => onUpdate({...settings, imageGenerationMode: 'generate'})}
                                className={`flex-1 py-2 text-xs font-bold uppercase rounded-md transition-all ${settings.imageGenerationMode === 'generate' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                             >
                                 Generate Images
                             </button>
                             <button 
                                onClick={() => onUpdate({...settings, imageGenerationMode: 'prompt_only'})}
                                className={`flex-1 py-2 text-xs font-bold uppercase rounded-md transition-all ${settings.imageGenerationMode === 'prompt_only' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                             >
                                 Get Prompts Only
                             </button>
                        </div>
                        <div className="text-[10px] text-zinc-500 px-1">
                           {settings.imageGenerationMode === 'generate' ? 'The agent will create actual images.' : 'The agent will create expert prompts for Midjourney/DALL-E.'}
                        </div>
                    </div>

                    {/* Image Model Selection (Only if Generate) */}
                    {settings.imageGenerationMode === 'generate' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Select Model</label>
                            <div className="flex flex-col gap-2">
                                {/* Option 1: Flash (Standard) */}
                                <button 
                                    onClick={() => onUpdate({...settings, imageModel: 'gemini-2.5-flash-image'})}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left group ${settings.imageModel === 'gemini-2.5-flash-image' ? 'bg-purple-900/20 border-purple-500/50' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
                                >
                                    <div className={`p-2 rounded-lg ${settings.imageModel === 'gemini-2.5-flash-image' ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                        <Zap className="w-5 h-5"/>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <div className="text-sm font-bold text-white">Gemini Flash (Nano Banana)</div>
                                            {settings.imageModel === 'gemini-2.5-flash-image' && <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 font-bold uppercase">Active</span>}
                                        </div>
                                        <div className="text-[11px] text-zinc-400 mt-0.5">Fast, free tier supported.</div>
                                    </div>
                                </button>

                                {/* Option 2: Imagen (Paid) */}
                                <button 
                                    onClick={() => onUpdate({...settings, imageModel: 'imagen-4.0-generate-001'})}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left group ${settings.imageModel === 'imagen-4.0-generate-001' ? 'bg-cyan-900/20 border-cyan-500/50' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
                                >
                                    <div className={`p-2 rounded-lg ${settings.imageModel === 'imagen-4.0-generate-001' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                        <ImagePlus className="w-5 h-5"/>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <div className="text-sm font-bold text-white">Imagen 3 (High-Fidelity)</div>
                                            {settings.imageModel === 'imagen-4.0-generate-001' && <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30 font-bold uppercase">Active</span>}
                                        </div>
                                        <div className="text-[11px] text-zinc-400 mt-0.5">Photorealistic quality.</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="h-px bg-zinc-800 w-full"/>

                    {/* Agent Permissions */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Agent Permissions</label>
                        <div className="space-y-2">
                             {[
                                 { key: 'confirmAutoWrite', label: 'Require approval before modifying Draft' },
                                 { key: 'confirmCanvas', label: 'Require approval before editing Canvas' },
                             ].map((opt) => (
                                 <div key={opt.key} className="flex items-center justify-between p-2 rounded hover:bg-zinc-900/50 group">
                                     <span className="text-xs text-zinc-300 group-hover:text-white transition-colors">{opt.label}</span>
                                     <button 
                                        onClick={() => onUpdate({...settings, [opt.key]: !settings[opt.key as keyof AppSettings]})}
                                        className={`w-9 h-5 rounded-full relative transition-colors ${settings[opt.key as keyof AppSettings] ? 'bg-cyan-600' : 'bg-zinc-700'}`}
                                     >
                                         <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${settings[opt.key as keyof AppSettings] ? 'translate-x-4' : ''}`}/>
                                     </button>
                                 </div>
                             ))}
                        </div>
                    </div>

                    <div className="h-px bg-zinc-800 w-full"/>
                    
                    {/* Advanced API Key */}
                    <div>
                         <button 
                            onClick={handleSelectKey}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition-colors"
                        >
                            <Key className="w-3 h-3"/> Switch API Key (Advanced)
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

// --- Quick Actions Menu ---
const QuickActions: React.FC<{ onSelect: (prompt: string) => void }> = ({ onSelect }) => {
    const actions = [
        { icon: BrainCircuit, label: 'Deep Critique', prompt: 'Perform a ruthless academic critique of the current draft. Identify logical fallacies, weak premises, and areas where evidence is thin. Use `deepReason` to structure your critique.' },
        { icon: Quote, label: 'Find Contradictions', prompt: 'Act as a "Red Team". Search the web specifically for evidence that *contradicts* my central thesis. Present the strongest counter-arguments available.' },
        { icon: CheckCircle2, label: 'Verify Claims', prompt: 'Scan the draft for unsupported claims. For each major claim, use `searchWeb` to find authoritative sources. Then, use `citeSources` or `updateDraft` to add the necessary evidence.' },
        { icon: Layout, label: 'Generate Outline', prompt: 'Propose a structured, academic outline for this research project. Visualize the flow of arguments using `generateCanvas`.' },
        { icon: Grid, label: 'Create Comparison Table', prompt: 'Analyze the draft to identify key comparisons (e.g., methodologies, theories, results). Compile these into a structured dataset using `manageTables`.' },
        { icon: Sparkles, label: 'Polish Intro', prompt: 'Elevate the introduction. Rewrite it to be compelling, precise, and academically rigorous. Ensure the thesis statement is crystal clear.' },
    ];

    return (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in z-30 ring-1 ring-white/10">
            <div className="p-2 bg-zinc-900/50 border-b border-zinc-800 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                Quick Research Actions
            </div>
            <div className="p-1">
                {actions.map((action, i) => (
                    <button 
                        key={i} 
                        onClick={() => onSelect(action.prompt)}
                        className="w-full text-left px-3 py-2.5 hover:bg-zinc-800 rounded-lg flex items-center gap-3 transition-colors group"
                    >
                        <action.icon className="w-4 h-4 text-cyan-500 group-hover:text-cyan-400 shrink-0" />
                        <span className="text-xs text-zinc-300 group-hover:text-white leading-tight">{action.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- Main View ---

const ResearchWriteView: React.FC<ResearchWriteViewProps> = ({ project }) => {
  // --- Global State ---
  const [activeView, setActiveView] = useState<ViewMode>('draft');
  const [sidebarView, setSidebarView] = useState<'explorer' | 'tools'>('explorer');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // --- Content State ---
  const [draftContent, setDraftContent] = useState(project.files.draft.content);
  const [draftMode, setDraftMode] = useState<'edit' | 'preview'>('edit');
  const [canvasData, setCanvasData] = useState<CanvasData>(project.files.canvas.content);
  const [tables, setTables] = useState<Table[]>(project.files.tables.content || []);
  const [browserUrl, setBrowserUrl] = useState<string>('');
  const [settings, setSettings] = useState<AppSettings>(project.files.meta.content.settings || {
      imageGenerationMode: 'generate',
      imageModel: 'gemini-2.5-flash-image',
      chatPosition: 'bottom',
      confirmAutoWrite: true,
      confirmCanvas: false,
      confirmImageGen: false
  });
  
  // --- Agent & Tools State ---
  const [messages, setMessages] = useState<ChatMessage[]>(project.files.meta.content.chatHistory || [
    { id: '0', role: 'model', content: "System ready. I have access to your draft, canvas, and browser. How can I help?", timestamp: Date.now() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcessAction, setCurrentProcessAction] = useState<string | null>(null);
  
  // Confirmation State
  const [pendingTool, setPendingTool] = useState<{ id: string, name: string, args: any, resolve: (v:boolean)=>void } | null>(null);

  // --- Sources & Attachments ---
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [customSources, setCustomSources] = useState<string[]>(project.files.meta.content.sources || []);
  const [newSourceUrl, setNewSourceUrl] = useState('');
  
  // Pickers/Modals
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showNodeAttachmentPicker, setShowNodeAttachmentPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [attachingNodeId, setAttachingNodeId] = useState<string | null>(null);
  
  // -- Auth Error State --
  const [showAuthPicker, setShowAuthPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeToolsRef = useRef<Set<string>>(new Set());

  // --- Sync State ---
  const [saveState, setSaveState] = useState<SaveState>({ status: 'synced', lastSaved: Date.now(), canUndo: false });
  const draftHistoryRef = useRef<string>(draftContent);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Refs ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const orchestratorRef = useRef<AgentOrchestrator | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const draftContainerRef = useRef<HTMLDivElement>(null); // For Scroll restoration
  const messagesLengthRef = useRef(messages.length);

  // --- Initialization ---
  useEffect(() => {
     // Gather node attachments to provide as context
     const nodeAttachmentSources = canvasData.nodes
        .flatMap(n => n.attachments || [])
        .map(a => `Attachment on Canvas Node: ${a.name}`);

     orchestratorRef.current = new AgentOrchestrator(
        process.env.API_KEY || '',
        messages.map(m => ({ 
            role: m.role, 
            parts: m.role === 'user' && m.attachments?.length ? 
               [{ text: m.content }, ...m.attachments.filter(a => a.type==='image').map(a => ({ inlineData: { data: a.data, mimeType: a.mime } }))]
               : [{ text: m.content }] 
        })).slice(1), 
        {
            projectId: project.id,
            assetsFolderId: project.assetsFolderId,
            draftContent,
            canvasData,
            customSources: [...customSources, ...attachments.map(a => `Attachment: ${a.name}`), ...nodeAttachmentSources],
            enabledTools: ['readProjectContext', 'searchWeb', 'deepReason', 'updateDraft', 'citeSources', 'generateCanvas', 'analyzeImage', 'searchYouTube', 'readWebPage', 'generateImage', 'manageTables'],
            currentBrowserUrl: browserUrl,
            imageModel: settings.imageModel, // Pass the selected model
            imageGenerationMode: settings.imageGenerationMode, // Pass the selected strategy
            // @ts-ignore
            tables: tables // Pass tables to context
        }
     );
  }, [attachments, customSources, draftContent, canvasData, tables, browserUrl, project.id, messages.length, settings.imageModel, settings.imageGenerationMode]); 

  // --- Auto-Save Logic (includes Metadata) ---
  useEffect(() => {
    const save = async () => {
      setSaveState(prev => ({ ...prev, status: 'saving' }));
      try {
        await DriveService.saveDraft(project.files.draft.id, draftContent);
        await DriveService.saveCanvas(project.files.canvas.id, canvasData);
        await DriveService.saveTables(project.files.tables.id, tables, project.id);
        await DriveService.saveMetadata(project.files.meta.id, {
            created: project.files.meta.content.created,
            version: project.files.meta.content.version + 1,
            settings: settings,
            sources: customSources,
            chatHistory: messages
        });
        setSaveState(prev => ({ ...prev, status: 'synced', lastSaved: Date.now() }));
      } catch (err: any) {
        console.error("Auto-save failed", err);
        // Handle Token Expiry
        if (err.message === 'TOKEN_EXPIRED') {
            setShowAuthPicker(true);
        }
        setSaveState(prev => ({ ...prev, status: 'error' }));
      }
    };
    const timer = setTimeout(save, 3000); 
    return () => clearTimeout(timer);
  }, [draftContent, canvasData, tables, messages, customSources, settings]);

  // --- Auto-Scroll Logic ---
  useEffect(() => {
    // Only smooth scroll for new messages/actions (length change), 
    // but use instant scroll for streaming content updates (same length) to prevent stutter.
    const isNewMessage = messages.length !== messagesLengthRef.current;
    messagesLengthRef.current = messages.length;

    messagesEndRef.current?.scrollIntoView({ 
        behavior: isNewMessage || currentProcessAction ? 'smooth' : 'auto',
        block: 'end'
    });
  }, [messages, currentProcessAction]);

  const handleSendMessage = async (text: string, retryAttachments?: Attachment[]) => {
      if (!text.trim()) return;
      const currentAttachments = retryAttachments || attachments;
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now(), attachments: currentAttachments };
      
      setMessages(prev => [...prev, userMsg]);
      setIsProcessing(true);
      setCurrentProcessAction('Thinking...');
      setInputValue('');
      setAttachments([]); 
      activeToolsRef.current.clear();

      // Reset textarea height
      const ta = document.querySelector('textarea') as HTMLTextAreaElement;
      if (ta) ta.style.height = 'auto';

      try {
          if (!orchestratorRef.current) throw new Error("Agent not initialized");
          const responseId = (Date.now() + 1).toString();
          setMessages(prev => [...prev, { id: responseId, role: 'model', content: '', toolActivity: [], timestamp: Date.now() }]);

          const finalResponse = await orchestratorRef.current.sendMessage(
              [{ text }],
              {
                  onToolStart: (callId, toolName) => {
                      activeToolsRef.current.add(toolName);
                      const tools = Array.from(activeToolsRef.current);
                      const label = tools.length > 1 
                          ? `Multi-tasking: ${tools.join(', ')}...` 
                          : `Using ${toolName}...`;
                      setCurrentProcessAction(label);

                      setMessages(prev => prev.map(m => m.id === responseId ? {
                          ...m,
                          toolActivity: m.toolActivity?.some(t => t.id === callId) ? m.toolActivity : [...(m.toolActivity || []), { id: callId, type: 'tool', label: toolName, status: 'running' }]
                      } : m));
                  },
                  onToolResult: (res) => {
                       activeToolsRef.current.delete(res.toolName);
                       const tools = Array.from(activeToolsRef.current);
                       if (tools.length > 0) {
                           setCurrentProcessAction(`Multi-tasking: ${tools.join(', ')}...`);
                       } else {
                           setCurrentProcessAction('Synthesizing Response...');
                       }

                       // AUTO-ADD SOURCES TO SIDEBAR
                       if (res.toolName === 'searchWeb' && res.meta?.sources) {
                           const newUrls = res.meta.sources
                              .map((s: any) => s.uri)
                              .filter((u: any) => typeof u === 'string');
                           
                           if (newUrls.length > 0) {
                               setCustomSources(prev => {
                                   const next = new Set([...prev, ...newUrls]);
                                   return Array.from(next);
                               });
                           }
                       }

                       setMessages(prev => prev.map(m => m.id === responseId ? {
                          ...m,
                          toolActivity: m.toolActivity?.map(t => t.id === res.callId ? { ...t, status: 'done', output: res.output, meta: res.meta } : t)
                      } : m));
                  },
                  onDraftUpdate: (newContent) => setDraftContent(newContent),
                  onCanvasUpdate: (newData) => setCanvasData(newData),
                  // @ts-ignore
                  onTablesUpdate: (newTables) => setTables(newTables),
                  getSessionImages: () => {
                      const imgs: Record<string, string> = {};
                      [...messages, userMsg].forEach(m => m.attachments?.forEach(a => { if (a.type === 'image') imgs[a.id] = a.data; }));
                      return imgs;
                  } 
              }
          );
          setMessages(prev => prev.map(m => m.id === responseId ? { ...m, content: finalResponse } : m));
      } catch (err: any) {
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: `Error: ${err.message}`, isError: true, timestamp: Date.now() }]);
      } finally {
          setIsProcessing(false);
          setCurrentProcessAction(null);
      }
  };

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (ev) => {
              const result = ev.target?.result as string;
              // result is data url: data:image/png;base64,...
              const [mimePart, dataPart] = result.split(',');
              const mime = mimePart.split(':')[1].split(';')[0];
              
              let type: 'image' | 'pdf' | 'text' = 'text';
              if (mime.startsWith('image/')) type = 'image';
              else if (mime === 'application/pdf') type = 'pdf';

              const newAtt: Attachment = {
                  id: `local_${Date.now()}`,
                  type,
                  mime,
                  name: file.name,
                  data: dataPart
              };
              setAttachments(prev => [...prev, newAtt]);
          };
          reader.readAsDataURL(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportDraft = async (format: 'md' | 'txt' | 'doc' | 'pdf') => {
      const content = draftContent;
      const projectName = project.name.replace(/\s+/g, '_');

      if (format === 'pdf') {
          // Print PDF
          const htmlContent = await marked.parse(content);
          const printWindow = window.open('', '_blank');
          if (printWindow) {
              printWindow.document.write(`
                  <html>
                      <head>
                          <title>${project.name}</title>
                          <style>
                              body { font-family: sans-serif; padding: 40px; line-height: 1.6; color: #000; }
                              h1, h2, h3 { color: #000; }
                              img { max-width: 100%; }
                              pre { background: #f4f4f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
                              blockquote { border-left: 4px solid #ccc; padding-left: 10px; color: #666; }
                              table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                              th { background-color: #f4f4f5; }
                          </style>
                      </head>
                      <body>
                          ${htmlContent}
                          <script>
                              window.onload = () => { window.print(); setTimeout(() => window.close(), 1000); };
                          </script>
                      </body>
                  </html>
              `);
              printWindow.document.close();
          }
          setShowExportMenu(false);
          return;
      }

      if (format === 'doc') {
          // Word Export (HTML masquerading as doc)
          const htmlContent = await marked.parse(content);
          const docContent = `
              <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
              <head><meta charset='utf-8'><title>${project.name}</title></head>
              <body>${htmlContent}</body>
              </html>
          `;
          const blob = new Blob([docContent], { type: 'application/msword' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projectName}.doc`;
          a.click();
          URL.revokeObjectURL(url);
          setShowExportMenu(false);
          return;
      }

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportMenu(false);
  };

  const handleAttachToNode = (files: Attachment[]) => {
      if (!attachingNodeId) return;
      const newNodes = canvasData.nodes.map(n => {
          if (n.id === attachingNodeId) {
              return { ...n, attachments: [...(n.attachments || []), ...files] };
          }
          return n;
      });
      setCanvasData({ ...canvasData, nodes: newNodes });
      setAttachingNodeId(null);
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-white font-sans overflow-hidden">
        
        {/* --- LEFT SIDEBAR (Explorer & Tools) --- */}
        <div className={`
             flex-shrink-0 border-r border-zinc-800 bg-[#0c0c0e] flex flex-col transition-all duration-300 relative z-20
             ${isSidebarCollapsed ? 'w-14' : 'w-72'}
        `}>
             {/* Header */}
             <div className="h-14 flex items-center justify-between px-3 border-b border-zinc-800">
                 {!isSidebarCollapsed && <div className="font-bold text-sm tracking-widest uppercase text-white px-2">Research Deck</div>}
                 <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800">
                     {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5"/> : <PanelLeftClose className="w-5 h-5"/>}
                 </button>
             </div>

             {/* Mode Switcher */}
             {!isSidebarCollapsed ? (
                <div className="flex p-2 gap-1 border-b border-zinc-800">
                    <button 
                       onClick={() => setSidebarView('explorer')}
                       className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-md transition-colors ${sidebarView === 'explorer' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                       Explorer
                    </button>
                    <button 
                       onClick={() => setSidebarView('tools')}
                       className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-md transition-colors ${sidebarView === 'tools' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                       Sources & Assets
                    </button>
                </div>
             ) : (
                <div className="flex flex-col items-center gap-4 py-4">
                     <button onClick={() => { setSidebarCollapsed(false); setSidebarView('explorer'); }} className="p-2 text-zinc-500 hover:text-white"><Files className="w-5 h-5"/></button>
                     <button onClick={() => { setSidebarCollapsed(false); setSidebarView('tools'); }} className="p-2 text-zinc-500 hover:text-white"><HardDrive className="w-5 h-5"/></button>
                </div>
             )}

             {/* Sidebar Content */}
             {!isSidebarCollapsed && (
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
                     
                     {sidebarView === 'explorer' ? (
                         <>
                             {/* Project Stats */}
                             <div className="bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 space-y-2">
                                 <div className="text-[10px] font-bold text-zinc-500 uppercase">Project Status</div>
                                 <div className="flex justify-between items-center text-xs">
                                     <span className="text-zinc-400">Save Status:</span>
                                     <span className={`flex items-center gap-1.5 font-bold ${saveState.status === 'error' ? 'text-red-500' : saveState.status === 'saving' ? 'text-yellow-500' : 'text-green-500'}`}>
                                         {saveState.status === 'saving' && <RefreshCw className="w-3 h-3 animate-spin"/>}
                                         {saveState.status === 'synced' && <CheckCircle2 className="w-3 h-3"/>}
                                         {saveState.status.toUpperCase()}
                                     </span>
                                 </div>
                                 <div className="text-[10px] text-zinc-600 text-right">
                                     Last saved: {new Date(saveState.lastSaved).toLocaleTimeString()}
                                 </div>
                             </div>

                             {/* Navigation Links */}
                             <div className="space-y-1">
                                 {[
                                     { id: 'draft', label: 'Draft Document', icon: FileText },
                                     { id: 'canvas', label: 'Mind Map / Canvas', icon: BrainCircuit },
                                     { id: 'tables', label: 'Data & Charts', icon: Grid },
                                     { id: 'assets', label: 'Project Assets', icon: ImagePlus },
                                     { id: 'browser', label: 'Web Browser', icon: Globe },
                                 ].map((item) => (
                                     <button
                                         key={item.id}
                                         onClick={() => setActiveView(item.id as ViewMode)}
                                         className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${activeView === item.id ? 'bg-zinc-800 text-white font-medium shadow-md' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}
                                     >
                                         <item.icon className={`w-4 h-4 ${activeView === item.id ? 'text-cyan-400' : 'text-zinc-500 group-hover:text-zinc-400'}`} />
                                         {item.label}
                                     </button>
                                 ))}
                             </div>
                         </>
                     ) : (
                         <>
                            {/* Sources List */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Sources ({customSources.length})</span>
                                    <button onClick={() => setShowSourcePicker(!showSourcePicker)} className="text-zinc-400 hover:text-white"><Plus className="w-4 h-4"/></button>
                                </div>
                                
                                {showSourcePicker && (
                                    <div className="p-2 bg-zinc-900 rounded border border-zinc-800 animate-in fade-in slide-in-from-top-1">
                                        <input 
                                            value={newSourceUrl}
                                            onChange={(e) => setNewSourceUrl(e.target.value)}
                                            placeholder="https://..."
                                            className="w-full bg-black text-xs p-1.5 border border-zinc-700 rounded mb-2 focus:outline-none focus:border-cyan-500 text-white"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && newSourceUrl.trim()) {
                                                    setCustomSources([...customSources, newSourceUrl.trim()]);
                                                    setNewSourceUrl('');
                                                    setShowSourcePicker(false);
                                                }
                                            }}
                                        />
                                        <div className="text-[10px] text-zinc-500">Press Enter to add URL</div>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    {customSources.length === 0 ? (
                                        <div className="text-xs text-zinc-600 italic px-2">No sources added yet.</div>
                                    ) : (
                                        customSources.map((src, i) => (
                                            <div key={i} className="group flex items-center justify-between px-2 py-1.5 bg-zinc-900/30 hover:bg-zinc-900 rounded border border-transparent hover:border-zinc-800 transition-all">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <Globe className="w-3 h-3 text-cyan-800 group-hover:text-cyan-500 shrink-0"/>
                                                    <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-cyan-400 truncate block max-w-[140px]" title={src}>
                                                        {src.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                                                    </a>
                                                </div>
                                                <button onClick={() => setCustomSources(customSources.filter((_, idx) => idx !== i))} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500"><X className="w-3 h-3"/></button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="h-px bg-zinc-800 w-full" />
                            
                            {/* Mini Asset Gallery */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Recent Assets</span>
                                    <button onClick={() => setActiveView('assets')} className="text-[10px] text-cyan-500 hover:underline">View All</button>
                                </div>
                                {/* We can't easily preview Drive assets here without fetching, so we just link to Assets view */}
                                <div className="grid grid-cols-3 gap-2">
                                    {[1,2,3].map(i => (
                                        <div key={i} onClick={() => setActiveView('assets')} className="aspect-square bg-zinc-900 rounded border border-zinc-800 hover:border-zinc-600 cursor-pointer flex items-center justify-center">
                                            <ImageIcon className="w-4 h-4 text-zinc-700"/>
                                        </div>
                                    ))}
                                </div>
                            </div>
                         </>
                     )}
                 </div>
             )}
             
             {/* Footer User/Settings */}
             <div className="p-3 border-t border-zinc-800">
                  <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                      <div className="w-8 h-8 rounded-xl bg-black border border-zinc-800 flex items-center justify-center shadow-lg relative overflow-hidden group">
                           <div className="absolute inset-0 bg-cyan-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity"/>
                           <Logo className="w-5 h-5 relative z-10" />
                      </div>
                      {!isSidebarCollapsed && (
                          <div className="flex-1 overflow-hidden">
                              <div className="text-xs font-bold text-white truncate">{project.name}</div>
                              <div className="text-[10px] text-zinc-500">Free Tier / Pro</div>
                          </div>
                      )}
                      {!isSidebarCollapsed && (
                          <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white">
                              <Settings2 className="w-4 h-4"/>
                          </button>
                      )}
                  </div>
             </div>
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div className={`flex-1 flex min-w-0 bg-[#000000] relative ${settings.chatPosition === 'right' ? 'flex-row' : 'flex-col'}`}>
            
            {/* Viewport Content */}
            <div className="flex-1 overflow-hidden relative h-full">
                {activeView === 'draft' && (
                    <div className="h-full flex flex-col">
                        <div className="h-10 flex items-center justify-between px-4 bg-[#09090b] border-b border-zinc-800 shrink-0">
                            <div className="flex gap-2">
                                <button onClick={() => setDraftMode('edit')} className={`text-xs uppercase font-bold px-3 py-1 rounded ${draftMode === 'edit' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Edit</button>
                                <button onClick={() => setDraftMode('preview')} className={`text-xs uppercase font-bold px-3 py-1 rounded ${draftMode === 'preview' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Preview</button>
                            </div>
                            <div className="relative">
                                <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2 py-1 hover:bg-zinc-800 rounded"><Download className="w-3.5 h-3.5"/> Export</button>
                                {showExportMenu && (
                                    <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 z-30">
                                        <button onClick={() => exportDraft('md')} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"><FileText className="w-3 h-3"/> Markdown (.md)</button>
                                        <button onClick={() => exportDraft('txt')} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"><FileText className="w-3 h-3"/> Plain Text (.txt)</button>
                                        <button onClick={() => exportDraft('doc')} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"><FileText className="w-3 h-3"/> Word (.doc)</button>
                                        <button onClick={() => exportDraft('pdf')} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"><Printer className="w-3 h-3"/> Print / PDF</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                           {draftMode === 'edit' ? (
                               <MarkdownEditor value={draftContent} onChange={setDraftContent} />
                           ) : (
                               <div className="h-full overflow-y-auto p-8 md:p-12 lg:p-16 max-w-4xl mx-auto prose prose-invert prose-zinc">
                                   <ChatMessageComp msg={{ role: 'model', content: draftContent, timestamp: Date.now() }} />
                               </div>
                           )}
                        </div>
                    </div>
                )}

                {activeView === 'canvas' && (
                    <CanvasBoard 
                       data={canvasData} 
                       onUpdate={setCanvasData} 
                       onAttachFiles={(nodeId) => { setAttachingNodeId(nodeId); setShowNodeAttachmentPicker(true); }}
                    />
                )}

                {activeView === 'tables' && (
                    <SpreadsheetView tables={tables} onUpdate={setTables} />
                )}

                {activeView === 'browser' && (
                    <BrowserPanel url={browserUrl} onUrlChange={setBrowserUrl} />
                )}

                {activeView === 'assets' && (
                    <AssetStudio 
                       assetsFolderId={project.assetsFolderId} 
                       onAddToChat={(att) => setAttachments(prev => [...prev, att])}
                       onAuthError={() => setShowAuthPicker(true)}
                    />
                )}
            </div>

            {/* --- AI CHAT INTERFACE --- */}
            <div 
               className={`flex-shrink-0 bg-[#09090b] flex flex-col relative z-30 shadow-[0_0_40px_rgba(0,0,0,0.3)] 
                  ${settings.chatPosition === 'right' 
                      ? 'border-l border-zinc-800 h-full w-[400px] xl:w-[480px]' 
                      : 'border-t border-zinc-800 h-[50%]'
                  }
               `}
               style={settings.chatPosition === 'right' ? {} : { height: '50%' }}
            >
                {/* Chat Header */}
                <div className="h-14 flex items-center justify-between px-6 border-b border-zinc-800/50 bg-[#09090b]/80 backdrop-blur-md shrink-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-zinc-600'}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isProcessing ? 'text-cyan-400' : 'text-zinc-500'}`}>
                            {isProcessing ? (currentProcessAction || 'Processing...') : 'Agent Idle'}
                        </span>
                    </div>
                    <button 
                        onClick={() => setMessages([])} 
                        className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-950/10 rounded-lg transition-colors"
                        title="Clear Conversation"
                    >
                        <Trash2 className="w-4 h-4"/>
                    </button>
                </div>

                {/* Messages Area */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-0 space-y-0 relative bg-[#050505]">
                    {messages.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 pointer-events-none opacity-50 px-10 text-center">
                            <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800 shadow-xl">
                                <Bot className="w-8 h-8 text-zinc-500"/>
                            </div>
                            <p className="text-sm font-medium text-zinc-400">Platinium Research</p>
                            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                                Ask me to search the web, analyze data, visualize concepts, or write your paper.
                            </p>
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <ChatMessageComp 
                           key={msg.id} 
                           msg={msg} 
                           onLinkClick={(url) => { setActiveView('browser'); setBrowserUrl(url); }}
                           onRetry={i === messages.length - 1 && msg.isError ? () => {
                               const lastUserMsg = messages[i-1];
                               if (lastUserMsg && lastUserMsg.role === 'user') {
                                   setMessages(prev => prev.slice(0, i));
                                   handleSendMessage(lastUserMsg.content, lastUserMsg.attachments);
                               }
                           } : undefined}
                        />
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-5 bg-[#09090b] relative">
                    
                    {/* Floating Attachments List */}
                    {attachments.length > 0 && (
                        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 px-1">
                            {attachments.map((att) => (
                                <div key={att.id} className="relative group flex-shrink-0 animate-in slide-in-from-bottom-2 fade-in duration-300">
                                    <div className="w-16 h-16 rounded-xl border border-zinc-700 bg-zinc-800 overflow-hidden flex items-center justify-center shadow-lg">
                                        {att.type === 'image' ? (
                                            <img src={`data:${att.mime};base64,${att.data}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all" />
                                        ) : (
                                            <FileText className="w-6 h-6 text-zinc-400"/>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-900 rounded-full text-zinc-400 hover:text-white border border-zinc-600 flex items-center justify-center shadow-md hover:bg-red-500 hover:border-red-500 transition-colors"
                                    >
                                        <X className="w-3 h-3"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="relative group bg-[#121214] p-2 rounded-2xl border border-zinc-800 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-700/50 transition-all shadow-lg">
                        
                        <input 
                            type="file" 
                            multiple 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleLocalUpload}
                        />

                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(inputValue);
                                }
                            }}
                            placeholder="Ask anything..."
                            className="w-full bg-transparent border-none focus:ring-0 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none min-h-[44px] max-h-60 py-3 px-3 custom-scrollbar"
                            rows={1}
                            style={{ height: 'auto' }}
                            onInput={(e) => {
                                const t = e.target as HTMLTextAreaElement;
                                t.style.height = 'auto';
                                t.style.height = t.scrollHeight + 'px';
                            }}
                        />

                        {/* Toolbar Row */}
                        <div className="flex items-center justify-between px-1 pb-1 mt-1">
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => setShowQuickActions(!showQuickActions)}
                                    className={`p-2 rounded-lg transition-colors ${showQuickActions ? 'bg-cyan-900/30 text-cyan-400' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
                                    title="Quick Actions"
                                >
                                    <Sparkles className="w-4 h-4"/>
                                </button>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                    title="Upload File"
                                >
                                    <Plus className="w-4 h-4"/>
                                </button>
                                <button 
                                    onClick={() => { setAttachingNodeId(null); setShowNodeAttachmentPicker(true); }}
                                    className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                    title="Import from Drive"
                                >
                                    <HardDrive className="w-4 h-4"/>
                                </button>
                            </div>

                            <button 
                                onClick={() => handleSendMessage(inputValue)}
                                disabled={!inputValue.trim() || isProcessing}
                                className={`
                                    w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
                                    ${(!inputValue.trim() && !isProcessing)
                                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' 
                                        : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_15px_rgba(255,255,255,0.15)] scale-100 hover:scale-105 active:scale-95'
                                    }
                                `}
                            >
                                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin"/> : <ArrowRight className="w-4 h-4"/>}
                            </button>
                        </div>

                        {/* Popover Menu */}
                        {showQuickActions && (
                            <div className="absolute bottom-full left-0 mb-3 ml-1 z-20">
                                <QuickActions onSelect={(prompt) => { 
                                    handleSendMessage(prompt); 
                                    setShowQuickActions(false); 
                                }}/>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-3 flex justify-center">
                        <span className="text-[10px] text-zinc-700 font-medium">Platinium Research Preview</span>
                    </div>
                </div>
            </div>
        </div>

        {/* --- MODALS --- */}
        <SettingsModal 
            isOpen={showSettings} 
            onClose={() => setShowSettings(false)} 
            settings={settings} 
            onUpdate={setSettings} 
        />
        
        <DrivePicker 
            isOpen={showNodeAttachmentPicker} 
            onClose={() => setShowNodeAttachmentPicker(false)}
            isConnected={true}
            onConnect={() => {}}
            onSelect={(files) => {
                if (attachingNodeId) {
                    handleAttachToNode(files);
                } else {
                    setAttachments(prev => [...prev, ...files]);
                }
            }}
        />

        {/* RE-AUTHENTICATION PICKER */}
        {showAuthPicker && (
            <DrivePicker 
                isOpen={true} 
                onClose={() => setShowAuthPicker(false)}
                isConnected={false} 
                onConnect={() => {
                    setShowAuthPicker(false);
                    setSaveState(prev => ({ ...prev, status: 'synced' }));
                }}
            />
        )}
    </div>
  );
};

export default ResearchWriteView;
