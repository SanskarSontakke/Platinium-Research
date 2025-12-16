
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Globe, PenTool, BrainCircuit, Eye, Copy, Save, Pencil, RefreshCw, AlertCircle, FileText, Image as ImageIcon, Youtube, ExternalLink, Zap, BookOpen, Box, ScanEye, ImagePlus, FolderOpen, Quote, Sparkles, Grid, ChevronDown, ChevronRight, Check } from 'lucide-react';

export interface ChatMessageProps {
  msg: any;
  onEditCaption?: (msgId: number, imgIndex: number, caption: string) => void;
  onRetry?: () => void;
  onLinkClick?: (url: string) => void;
}

// Vibrant Tool Configuration with Glow Effects
const TOOL_CONFIG: Record<string, { label: string, icon: any, color: string, bg: string, border: string, shadow: string, accent: string }> = {
  'readProjectContext': { 
    label: 'Context Analysis', 
    icon: FolderOpen, 
    color: 'text-zinc-300', 
    bg: 'bg-zinc-950', 
    border: 'border-zinc-700',
    shadow: 'shadow-zinc-900/10',
    accent: 'bg-zinc-600'
  },
  'searchWeb': { 
    label: 'Web Search', 
    icon: Globe, 
    color: 'text-cyan-300', 
    bg: 'bg-cyan-950/20', 
    border: 'border-cyan-500/50',
    shadow: 'shadow-cyan-500/20',
    accent: 'bg-cyan-500'
  },
  'updateDraft': { 
    label: 'Writing Engine', 
    icon: PenTool, 
    color: 'text-emerald-300', 
    bg: 'bg-emerald-950/20', 
    border: 'border-emerald-500/50',
    shadow: 'shadow-emerald-500/20',
    accent: 'bg-emerald-500'
  },
  'deepReason': { 
    label: 'Deep Reasoning', 
    icon: BrainCircuit, 
    color: 'text-violet-300', 
    bg: 'bg-violet-950/20', 
    border: 'border-violet-500/50',
    shadow: 'shadow-violet-500/20',
    accent: 'bg-violet-500'
  },
  'analyzeImage': { 
    label: 'Vision Analysis', 
    icon: ScanEye, 
    color: 'text-pink-300', 
    bg: 'bg-pink-950/20', 
    border: 'border-pink-500/50',
    shadow: 'shadow-pink-500/20',
    accent: 'bg-pink-500'
  },
  'searchYouTube': { 
    label: 'YouTube Search', 
    icon: Youtube, 
    color: 'text-red-300', 
    bg: 'bg-red-950/20', 
    border: 'border-red-500/50',
    shadow: 'shadow-red-500/20',
    accent: 'bg-red-500'
  },
  'generateImage': { 
    label: 'Art Generation', 
    icon: ImagePlus, 
    color: 'text-amber-300', 
    bg: 'bg-amber-950/20', 
    border: 'border-amber-500/50',
    shadow: 'shadow-amber-500/20',
    accent: 'bg-amber-500'
  },
  'readWebPage': { 
    label: 'Reading Page', 
    icon: BookOpen, 
    color: 'text-teal-300', 
    bg: 'bg-teal-950/20', 
    border: 'border-teal-500/50',
    shadow: 'shadow-teal-500/20',
    accent: 'bg-teal-500'
  },
  'generateCanvas': { 
    label: 'Canvas Builder', 
    icon: Box, 
    color: 'text-orange-300', 
    bg: 'bg-orange-950/20', 
    border: 'border-orange-500/50',
    shadow: 'shadow-orange-500/20',
    accent: 'bg-orange-500'
  },
  'citeSources': { 
    label: 'Citation Manager', 
    icon: Quote, 
    color: 'text-indigo-300', 
    bg: 'bg-indigo-950/20', 
    border: 'border-indigo-500/50',
    shadow: 'shadow-indigo-500/20',
    accent: 'bg-indigo-500'
  },
  'manageTables': {
    label: 'Data Tables', 
    icon: Grid,
    color: 'text-lime-300', 
    bg: 'bg-lime-950/20', 
    border: 'border-lime-500/50',
    shadow: 'shadow-lime-500/20',
    accent: 'bg-lime-500'
  }
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ msg, onEditCaption, onRetry, onLinkClick }) => {
  const isUser = msg.role === 'user';
  const hasTools = msg.toolActivity?.length > 0;
  
  return (
    <div className={`w-full py-6 border-b border-white/5 ${isUser ? 'bg-zinc-900/20' : 'bg-transparent'} relative group transition-colors duration-500`}>
      
      {/* Dynamic Model Gradient Border on Left */}
      {!isUser && !msg.isError && (
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-cyan-500 via-purple-500 to-cyan-500 opacity-60 group-hover:opacity-100 transition-all shadow-[0_0_10px_rgba(34,211,238,0.2)]" />
      )}
      
      <div className="px-4 md:px-8 max-w-5xl mx-auto"> 
        {/* Header Row */}
        <div className="flex items-center gap-4 mb-4 select-none">
           {isUser ? (
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center border border-zinc-700 shadow-sm ring-1 ring-black/50">
                    <div className="w-4 h-4 bg-zinc-400 rounded-sm" />
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-zinc-300 tracking-wider uppercase">You</span>
                </div>
             </div>
           ) : (
             <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-[0_0_20px_rgba(0,0,0,0.3)] ring-1 ring-white/10 ${msg.isError ? 'bg-red-950/50 border-red-800' : 'bg-cyan-950/30 border-cyan-800/80'}`}>
                   {msg.isError ? <AlertCircle className="w-4 h-4 text-red-500"/> : <Sparkles className="w-4 h-4 text-cyan-400 fill-cyan-400/20"/>}
                </div>
                <div className="flex flex-col">
                    <span className={`text-xs font-bold tracking-wider uppercase ${msg.isError ? 'text-red-500' : 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]'}`}>
                        {msg.isError ? 'System Error' : 'Platinium AI'}
                    </span>
                    <span className="text-[9px] text-zinc-600 font-medium">Model: Gemini 3 Pro</span>
                </div>
             </div>
           )}
           <span className="ml-auto text-[10px] text-zinc-700 font-mono opacity-50">
              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
           </span>
        </div>

        <div className="pl-0 md:pl-12">
            
            {/* 1. TOOL ACTIVITY CARDS */}
            {hasTools && (
              <div className="flex flex-col gap-3 mb-6 animate-in slide-in-from-left-2 duration-300">
                 {msg.toolActivity.map((act: any, i: number) => {
                    const config = TOOL_CONFIG[act.label] || { 
                        label: act.label, 
                        icon: Box, 
                        color: 'text-zinc-400', 
                        bg: 'bg-zinc-900', 
                        border: 'border-zinc-800',
                        shadow: 'shadow-none',
                        accent: 'bg-zinc-600'
                    };
                    
                    return (
                      <div 
                        key={i} 
                        className={`
                            relative rounded-xl border backdrop-blur-md overflow-hidden transition-all duration-300 
                            ${config.border} ${config.bg} shadow-lg ${config.shadow} 
                            hover:shadow-2xl hover:scale-[1.005] hover:border-opacity-100 border-opacity-60
                            group/tool max-w-3xl
                        `}
                      >
                        {/* Vertical Accent Strip */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.accent} opacity-80`} />

                        {/* Card Header */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-black/20 border-b border-white/5">
                            <div className={`flex items-center gap-2.5 text-xs font-bold uppercase tracking-wide ${config.color} drop-shadow-sm`}>
                              <div className={`p-1 rounded ${config.accent} bg-opacity-20`}>
                                 <config.icon className="w-3.5 h-3.5" />
                              </div>
                              <span>{config.label}</span>
                              {act.status === 'running' && <RefreshCw className="w-3 h-3 animate-spin opacity-70"/>}
                              {act.status === 'done' && <Check className="w-3 h-3 opacity-70"/>}
                            </div>
                            
                            {/* Sources Badges */}
                            {act.type === 'search' && act.meta?.sources && (
                                <div className="flex gap-1.5 flex-wrap justify-end">
                                    {act.meta.sources.slice(0, 3).map((s: any, idx: number) => (
                                        <button 
                                          key={idx}
                                          onClick={(e) => { e.stopPropagation(); onLinkClick?.(s.uri); }}
                                          className="text-[9px] text-cyan-200/80 hover:text-white bg-cyan-950/50 hover:bg-cyan-900 border border-cyan-800/50 hover:border-cyan-500 px-2 py-0.5 rounded-full flex items-center gap-1 transition-all"
                                        >
                                            <ExternalLink className="w-2.5 h-2.5"/> {s.title?.substring(0, 20) || 'Source'}
                                        </button>
                                    ))}
                                    {act.meta.sources.length > 3 && <span className="text-[9px] text-zinc-500 self-center">+{act.meta.sources.length - 3}</span>}
                                </div>
                            )}
                        </div>
                        
                        {/* Tool Output / Content */}
                        {act.output && (
                          <div className="bg-black/10">
                              <div className="p-3.5 font-mono text-[11px] leading-relaxed text-zinc-300/90 max-h-60 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-words selection:bg-white/20">
                                {act.output.trim()}
                              </div>
                              
                              {/* Generated Image inside Tool Card */}
                              {act.meta?.generatedImage && (
                                  <div className="p-4 border-t border-white/5 bg-black/40 flex justify-center">
                                      <div className="relative group/img rounded-lg overflow-hidden border border-zinc-700 shadow-xl max-w-sm">
                                          <img 
                                            src={`data:${act.meta.generatedImage.mimeType};base64,${act.meta.generatedImage.base64}`} 
                                            alt="Generated Art" 
                                            className="w-full h-auto object-cover"
                                          />
                                          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                                              <a 
                                                href={`data:${act.meta.generatedImage.mimeType};base64,${act.meta.generatedImage.base64}`} 
                                                download={`generated-art-${Date.now()}.png`}
                                                className="px-4 py-2 bg-white text-black font-bold uppercase text-xs rounded shadow-lg hover:scale-105 transition-transform"
                                              >
                                                Download
                                              </a>
                                          </div>
                                      </div>
                                  </div>
                              )}

                              {/* Meta Info Footer (Optional) */}
                              {act.meta?.url && (
                                  <div className="px-3.5 py-1.5 border-t border-white/5 bg-black/20 text-[10px] text-zinc-500 flex items-center gap-2 truncate">
                                      <Globe className="w-3 h-3"/> {act.meta.url}
                                  </div>
                              )}
                          </div>
                        )}
                      </div>
                    );
                 })}
              </div>
            )}

            {/* 2. ATTACHMENTS */}
            {msg.attachments?.length > 0 && (
               <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-6">
                  {msg.attachments.map((att: any, i: number) => (
                     <div key={i} className="flex flex-col gap-2 p-2 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800 hover:border-zinc-600 transition-all group/att cursor-pointer shadow-lg">
                        <div className="w-full aspect-square rounded-lg overflow-hidden bg-black border border-zinc-800 flex items-center justify-center relative">
                            {att.type === 'image' ? (
                               <img src={`data:${att.mime};base64,${att.data}`} className="w-full h-full object-cover opacity-80 group-hover/att:opacity-100 transition-opacity" />
                            ) : (
                               <FileText className="w-8 h-8 text-zinc-600 group-hover/att:text-zinc-300 transition-colors" />
                            )}
                        </div>
                        <div className="px-1 pb-1">
                           <p className="text-[10px] font-bold text-zinc-400 truncate group-hover/att:text-white transition-colors" title={att.name}>{att.name}</p>
                           <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{att.type.toUpperCase()}</p>
                        </div>
                     </div>
                  ))}
               </div>
            )}

            {/* 3. MAIN MESSAGE CONTENT */}
            <div className={`
                ${isUser ? 'text-zinc-300' : 'text-zinc-100'} 
                prose prose-invert prose-sm max-w-none 
                leading-7 tracking-wide selection:bg-cyan-900/50 selection:text-cyan-100
            `}>
                {msg.isError ? (
                    <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-5 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-red-900/20 rounded-lg">
                                <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wide">Generation Error</h4>
                                <p className="text-xs text-red-200/80 font-mono bg-black/40 p-3 rounded-lg border border-red-900/30">{msg.content}</p>
                            </div>
                        </div>
                        {onRetry && (
                            <button onClick={onRetry} className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-400 text-black font-bold rounded-lg text-xs uppercase tracking-wider transition-colors shadow-lg shadow-red-900/20">
                                <RefreshCw className="w-3.5 h-3.5" /> Retry Action
                            </button>
                        )}
                    </div>
                ) : (
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-white mt-8 mb-4 pb-2 border-b border-zinc-800" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-xl font-bold text-white mt-8 mb-4 flex items-center gap-2" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-lg font-bold text-zinc-100 mt-6 mb-3" {...props} />,
                            p: ({node, ...props}) => <p className="mb-4 text-zinc-300" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1 text-zinc-300 marker:text-zinc-500" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1 text-zinc-300 marker:text-zinc-500" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-cyan-500/50 bg-zinc-900/30 pl-4 py-2 italic text-zinc-400 my-6 rounded-r-lg" {...props} />,
                            code: ({node, ...props}) => {
                                const match = /language-(\w+)/.exec(props.className || '')
                                const isInline = !match && !String(props.children).includes('\n');
                                return isInline 
                                    ? <code className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded text-xs font-mono border border-zinc-700" {...props} />
                                    : <code className="block bg-[#0d0d0d] p-4 rounded-xl text-xs font-mono text-zinc-300 overflow-x-auto my-4 border border-zinc-800 shadow-inner" {...props} />
                            },
                            a: ({ node, ...props }) => (
                                <a 
                                {...props} 
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (props.href && onLinkClick) onLinkClick(props.href);
                                }}
                                className="text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer transition-colors decoration-cyan-500/30 underline-offset-2"
                                />
                            ),
                            table: ({node, ...props}) => <div className="overflow-x-auto mb-6 border border-zinc-800 rounded-xl shadow-lg"><table className="min-w-full divide-y divide-zinc-800" {...props} /></div>,
                            th: ({node, ...props}) => <th className="bg-zinc-900 px-4 py-3 text-left text-xs font-bold text-zinc-300 uppercase tracking-wider" {...props} />,
                            td: ({node, ...props}) => <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-400 border-t border-zinc-800/50" {...props} />
                        }}
                    >
                        {msg.content}
                    </ReactMarkdown>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
