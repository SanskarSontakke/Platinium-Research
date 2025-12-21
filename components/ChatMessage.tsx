
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Globe, PenTool, BrainCircuit, AlertCircle, FileText, Image as ImageIcon, Youtube, ExternalLink, Box, ScanEye, ImagePlus, FolderOpen, Quote, Sparkles, Grid, Check, RefreshCw } from 'lucide-react';

export interface ChatMessageProps {
  msg: any;
  onRetry?: () => void;
  onLinkClick?: (url: string) => void;
}

// Placeholder for missing icons used in TOOL_CONFIG
// Fix: Moved declaration before TOOL_CONFIG to avoid usage before declaration error
const BookOpen = (props: any) => <FileText {...props} />;

const TOOL_CONFIG: Record<string, { label: string, icon: any, color: string, accent: string }> = {
  'readProjectContext': { label: 'Context Analysis', icon: FolderOpen, color: 'text-zinc-400', accent: 'bg-zinc-600' },
  'searchWeb': { label: 'Web Search', icon: Globe, color: 'text-cyan-400', accent: 'bg-cyan-500' },
  'updateDraft': { label: 'Writing Engine', icon: PenTool, color: 'text-emerald-400', accent: 'bg-emerald-500' },
  'deepReason': { label: 'Deep Reasoning', icon: BrainCircuit, color: 'text-violet-400', accent: 'bg-violet-500' },
  'analyzeImage': { label: 'Vision Analysis', icon: ScanEye, color: 'text-pink-400', accent: 'bg-pink-500' },
  'searchYouTube': { label: 'YouTube Search', icon: Youtube, color: 'text-red-400', accent: 'bg-red-500' },
  'generateImage': { label: 'Art Generation', icon: ImagePlus, color: 'text-amber-400', accent: 'bg-amber-500' },
  'readWebPage': { label: 'Reading Page', icon: BookOpen, color: 'text-teal-400', accent: 'bg-teal-500' },
  'generateCanvas': { label: 'Canvas Builder', icon: Box, color: 'text-orange-400', accent: 'bg-orange-500' },
  'citeSources': { label: 'Citation Manager', icon: Quote, color: 'text-indigo-400', accent: 'bg-indigo-500' },
  'manageTables': { label: 'Data Tables', icon: Grid, color: 'text-lime-400', accent: 'bg-lime-500' }
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ msg, onRetry, onLinkClick }) => {
  const isUser = msg.role === 'user';
  const hasTools = msg.toolActivity && msg.toolActivity.length > 0;
  
  return (
    <div className={`w-full px-4 py-2 flex flex-col transition-all duration-500 animate-fade-in-up ${isUser ? 'items-end' : 'items-start'}`}>
      
      {/* Sender Header */}
      <div className={`flex items-center gap-2 mb-1.5 px-1 select-none ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`w-5 h-5 rounded-md flex items-center justify-center border shadow-sm ${isUser ? 'bg-zinc-800 border-zinc-700' : (msg.isError ? 'bg-red-950/40 border-red-800' : 'bg-cyan-950/40 border-cyan-800/40')}`}>
              {isUser ? (
                  <div className="w-2 h-2 bg-zinc-400 rounded-sm" />
              ) : (
                  msg.isError ? <AlertCircle className="w-3 h-3 text-red-500"/> : <Sparkles className="w-3 h-3 text-cyan-400 fill-cyan-400/20"/>
              )}
          </div>
          <span className={`text-[9px] font-black uppercase tracking-widest ${isUser ? 'text-zinc-500' : (msg.isError ? 'text-red-500' : 'text-cyan-500')}`}>
              {isUser ? 'Researcher' : 'Platinium'}
          </span>
      </div>

      {/* Message Bubble */}
      <div className={`
          relative max-w-[92%] rounded-2xl p-4 border transition-all duration-300 shadow-2xl backdrop-blur-md
          ${isUser 
            ? 'bg-zinc-900/40 border-zinc-800 text-zinc-300 rounded-tr-none' 
            : (msg.isError 
                ? 'bg-red-950/10 border-red-900/40 text-red-200/90 rounded-tl-none' 
                : 'bg-zinc-950/60 border-white/5 text-zinc-100 rounded-tl-none hover:border-white/10'
              )
          }
      `}>
          {/* Tool Activities inside bubble */}
          {hasTools && (
              <div className="flex flex-col gap-2 mb-4 border-b border-white/5 pb-4">
                  {msg.toolActivity.map((act: any, i: number) => {
                      const config = TOOL_CONFIG[act.label] || { label: act.label, icon: Box, color: 'text-zinc-400', accent: 'bg-zinc-600' };
                      return (
                          <div key={i} className="flex flex-col gap-1.5 animate-fade-in">
                              <div className="flex items-center justify-between">
                                  <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight ${config.color}`}>
                                      <config.icon className="w-3 h-3" />
                                      <span>{config.label}</span>
                                      {act.status === 'running' && <RefreshCw className="w-2.5 h-2.5 animate-spin opacity-50"/>}
                                      {act.status === 'done' && <Check className="w-2.5 h-2.5 opacity-60"/>}
                                  </div>
                              </div>
                              {act.output && (
                                  <div className="bg-black/20 rounded-lg p-2.5 font-mono text-[10px] text-zinc-400 leading-relaxed border border-white/5 max-h-32 overflow-y-auto custom-scrollbar">
                                      {act.output.trim()}
                                  </div>
                              )}
                          </div>
                      );
                  })}
              </div>
          )}

          {/* Attachments */}
          {msg.attachments?.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                  {msg.attachments.map((att: any, i: number) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden border border-white/5 bg-black/40 relative group/att cursor-zoom-in">
                          {att.type === 'image' ? (
                              <img src={`data:${att.mime};base64,${att.data}`} className="w-full h-full object-cover transition-transform group-hover/att:scale-110" alt={att.name}/>
                          ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                                  <FileText className="w-6 h-6 text-zinc-600" />
                                  <span className="text-[8px] text-zinc-500 font-bold uppercase truncate px-2 w-full text-center">{att.name}</span>
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          )}

          {/* Markdown Content */}
          <div className={`
              ${msg.isError ? 'prose-red' : 'prose-invert'} 
              prose prose-sm max-w-none prose-p:leading-relaxed prose-headings:mb-2 prose-headings:mt-4
              selection:bg-cyan-500/20
          `}>
              {msg.isError ? (
                  <div className="flex flex-col gap-3">
                      <p className="font-mono text-[11px] leading-relaxed bg-red-500/5 p-3 rounded-lg border border-red-900/20">{msg.content}</p>
                      {onRetry && (
                          <button onClick={onRetry} className="self-start flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-md text-[10px] uppercase tracking-wider transition-all">
                              <RefreshCw className="w-3 h-3" /> Retry Generation
                          </button>
                      )}
                  </div>
              ) : (
                  <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                          h1: (props) => <h1 className="text-base font-black border-b border-zinc-800 pb-2 mb-3 mt-1 text-white uppercase tracking-wider" {...props} />,
                          h2: (props) => <h2 className="text-sm font-bold mt-4 mb-2 text-white" {...props} />,
                          p: (props) => <p className="mb-3 text-[13px] text-zinc-300 leading-relaxed last:mb-0" {...props} />,
                          ul: (props) => <ul className="list-disc pl-4 mb-3 space-y-1 text-[13px] text-zinc-400" {...props} />,
                          ol: (props) => <ol className="list-decimal pl-4 mb-3 space-y-1 text-[13px] text-zinc-400" {...props} />,
                          code: ({ node, ...props }: any) => {
                            const isInline = !String(props.children).includes('\n');
                            return isInline 
                                ? <code className="bg-white/5 text-cyan-300/90 px-1 py-0.5 rounded text-[11px] font-mono border border-white/5" {...props} />
                                : <div className="my-3 overflow-x-auto rounded-xl border border-white/5 bg-black/40"><code className="block p-3 text-[11px] font-mono text-zinc-400" {...props} /></div>
                          },
                          a: (props) => (
                              <a 
                                {...props} 
                                onClick={(e) => { e.preventDefault(); if (props.href && onLinkClick) onLinkClick(props.href); }}
                                className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 decoration-cyan-500/30 font-medium transition-colors"
                              />
                          ),
                          table: (props) => <div className="my-4 overflow-x-auto rounded-lg border border-white/5"><table className="min-w-full divide-y divide-zinc-800" {...props} /></div>,
                          th: (props) => <th className="bg-white/5 px-3 py-2 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest" {...props} />,
                          td: (props) => <td className="px-3 py-2 text-[11px] text-zinc-500 border-t border-zinc-800/50" {...props} />
                      }}
                  >
                      {msg.content}
                  </ReactMarkdown>
              )}
          </div>
      </div>
      
      {/* Timestamp */}
      <span className={`text-[8px] mt-1 text-zinc-700 font-bold uppercase tracking-tighter ${isUser ? 'mr-1' : 'ml-1'}`}>
          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
      </span>
    </div>
  );
};
