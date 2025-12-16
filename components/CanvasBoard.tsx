
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CanvasData, CanvasNode, CanvasEdge, Attachment } from '../types';
import { 
  Move, Minus, Plus, Maximize, Lock, Unlock, GripHorizontal, Box, X, 
  Palette, Edit3, Type, FileText, Link as LinkIcon, MousePointer2, 
  Trash2, Lightbulb, Settings2, StickyNote, Paperclip, Image as ImageIcon,
  ArrowRight, Layout as LayoutIcon, RefreshCw, Zap, Upload
} from 'lucide-react';

interface CanvasBoardProps {
  data: CanvasData;
  onUpdate: (newData: CanvasData) => void;
  onAttachFiles?: (nodeId: string) => void; // Kept for backward compatibility or future use
  readOnly?: boolean;
}

const GRID_SIZE = 20;
const NODE_WIDTH = 240; // Widened slightly for better image display
const NODE_HEIGHT = 160;

const NODE_CONFIG: Record<string, { icon: any, color: string, label: string }> = {
  concept: { icon: Lightbulb, color: '#06b6d4', label: 'Concept' },
  process: { icon: Settings2, color: '#a855f7', label: 'Process' }, 
  note: { icon: StickyNote, color: '#eab308', label: 'Note' },  
};

export const CanvasBoard: React.FC<CanvasBoardProps> = ({ data, onUpdate, onAttachFiles, readOnly = false }) => {
  // View State
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<'select' | 'connect'>('select');
  
  // Interaction State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<CanvasNode | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Attachment State
  const [attachingNodeId, setAttachingNodeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const draggingNodeId = useRef<string | null>(null);
  const initialNodePos = useRef({ x: 0, y: 0 });

  // --- Helpers ---

  const screenToWorld = (screenX: number, screenY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - offset.x) / zoom,
      y: (screenY - rect.top - offset.y) / zoom
    };
  };

  const generateId = () => Math.random().toString(36).substr(2, 9);

  // --- Actions ---

  const addNode = (type: 'concept' | 'process' | 'note') => {
      if (readOnly) return;
      // Center of screen
      const center = screenToWorld(
          canvasRef.current ? canvasRef.current.getBoundingClientRect().width / 2 : 0,
          canvasRef.current ? canvasRef.current.getBoundingClientRect().height / 2 : 0
      );
      
      const newNode: CanvasNode = {
          id: generateId(),
          type,
          label: `New ${NODE_CONFIG[type].label}`,
          content: '',
          x: center.x - NODE_WIDTH/2,
          y: center.y - NODE_HEIGHT/2,
          color: NODE_CONFIG[type].color
      };

      onUpdate({
          ...data,
          nodes: [...data.nodes, newNode]
      });
      setSelectedId(newNode.id);
  };

  const deleteSelected = () => {
      if (readOnly || !selectedId) return;
      onUpdate({
          nodes: data.nodes.filter(n => n.id !== selectedId),
          edges: data.edges.filter(e => e.id !== selectedId && e.from !== selectedId && e.to !== selectedId)
      });
      setSelectedId(null);
      setEditingNode(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && attachingNodeId) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        const [mimePart, dataPart] = result.split(',');
        const mime = mimePart.split(':')[1].split(';')[0];
        
        const newAttachment: Attachment = {
          id: `node_img_${Date.now()}`,
          type: 'image',
          mime,
          name: file.name,
          data: dataPart
        };

        const newNodes = data.nodes.map(n => {
          if (n.id === attachingNodeId) {
             return { ...n, attachments: [...(n.attachments || []), newAttachment] };
          }
          return n;
        });
        
        onUpdate({ ...data, nodes: newNodes });
      };
      reader.readAsDataURL(file);
    }
    setAttachingNodeId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (nodeId: string, attId: string) => {
      if (readOnly) return;
      const newNodes = data.nodes.map(n => {
          if (n.id === nodeId) {
              return { ...n, attachments: n.attachments?.filter(a => a.id !== attId) };
          }
          return n;
      });
      onUpdate({ ...data, nodes: newNodes });
  };

  const runAutoLayout = () => {
      if (data.nodes.length === 0) return;
      
      const nodes = [...data.nodes];
      const edges = data.edges;
      
      // 1. Build Graph Structure
      const adj: Record<string, string[]> = {};
      const parents: Record<string, string[]> = {};
      const inDegree: Record<string, number> = {};

      nodes.forEach(n => { 
          adj[n.id] = []; 
          parents[n.id] = [];
          inDegree[n.id] = 0;
      });
      
      edges.forEach(e => {
          if (adj[e.from]) adj[e.from].push(e.to);
          if (parents[e.to]) {
              parents[e.to].push(e.from);
              inDegree[e.to]++;
          }
      });

      // 2. Assign Ranks (Longest Path Layering)
      const ranks: Record<string, number> = {};
      const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
      
      if (queue.length === 0 && nodes.length > 0) queue.push(nodes[0].id);

      queue.forEach(id => ranks[id] = 0);

      let head = 0;
      while(head < queue.length) {
          const u = queue[head++];
          const neighbors = adj[u] || [];
          
          neighbors.forEach(v => {
              ranks[v] = Math.max(ranks[v] || 0, (ranks[u] || 0) + 1);
              inDegree[v]--;
              if (inDegree[v] === 0) queue.push(v);
          });
      }

      nodes.forEach(n => {
          if (ranks[n.id] === undefined) ranks[n.id] = 0;
      });

      // 3. Group Nodes by Rank
      const maxRank = Math.max(...Object.values(ranks));
      const layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
      
      nodes.forEach(n => {
          const r = ranks[n.id];
          layers[r].push(n.id);
      });

      // 4. Calculate Coordinates
      const X_SPACING = 350; 
      const Y_SPACING = 250; // Increased spacing for nodes with images

      const newNodes = nodes.map(n => {
          const r = ranks[n.id];
          const layer = layers[r];
          const idx = layer.indexOf(n.id);
          
          const layerHeight = layer.length * Y_SPACING;
          const yOffset = -(layerHeight / 2);

          return {
              ...n,
              x: (r * X_SPACING),
              y: yOffset + (idx * Y_SPACING)
          };
      });

      onUpdate({ ...data, nodes: newNodes });
      
      if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          setOffset({ x: rect.width / 4, y: rect.height / 2 });
          setZoom(0.8);
      }
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      
      if (mode === 'connect') {
          if (connectingSourceId === null) {
              setConnectingSourceId(nodeId);
          } else {
              if (connectingSourceId !== nodeId) {
                  const newEdge: CanvasEdge = {
                      id: generateId(),
                      from: connectingSourceId,
                      to: nodeId,
                      color: '#71717a'
                  };
                  onUpdate({ ...data, edges: [...data.edges, newEdge] });
              }
              setConnectingSourceId(null);
              setMode('select');
          }
      } else {
          setSelectedId(nodeId);
          setConnectingSourceId(null);
      }
  };

  const getPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dist = Math.abs(x2 - x1);
    const controlDist = Math.max(dist * 0.5, 100); 
    return `M ${x1} ${y1} C ${x1 + controlDist} ${y1}, ${x2 - controlDist} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div className="relative w-full h-full bg-[#050505] overflow-hidden select-none group">
      {/* Hidden File Input for Images */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*"
        onChange={handleFileUpload}
      />

      {/* Background Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(#333 1px, transparent 1px)`,
          backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`
        }}
      />

      {/* Canvas Area */}
      <div 
        ref={canvasRef}
        className="w-full h-full outline-none"
        style={{ cursor: isDraggingCanvas.current ? 'grabbing' : mode === 'connect' ? 'crosshair' : 'default' }}
        onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('.interactive')) return;
            isDraggingCanvas.current = true;
            dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
            setSelectedId(null);
            if(mode === 'connect' && connectingSourceId) {
                setConnectingSourceId(null); 
            }
        }}
        onMouseMove={(e) => {
            if (isDraggingCanvas.current) {
                setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
            } else if (draggingNodeId.current && !readOnly) {
                 const deltaX = (e.clientX - dragStart.current.x) / zoom;
                 const deltaY = (e.clientY - dragStart.current.y) / zoom;
                 const newNodes = data.nodes.map(n => n.id === draggingNodeId.current ? { ...n, x: initialNodePos.current.x + deltaX, y: initialNodePos.current.y + deltaY } : n);
                 onUpdate({ ...data, nodes: newNodes });
            }
            if (mode === 'connect') {
                const worldPos = screenToWorld(e.clientX, e.clientY);
                setMousePos(worldPos);
            }
        }}
        onMouseUp={() => { isDraggingCanvas.current = false; draggingNodeId.current = null; }}
        onWheel={(e) => {
             e.preventDefault();
             e.stopPropagation();
             const s = Math.exp(-e.deltaY * 0.002);
             setZoom(z => Math.min(Math.max(0.1, z * s), 5));
        }}
      >
        <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: '0 0', width: '100%', height: '100%' }}>
            
            {/* Edges */}
            <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none">
                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#71717a"/>
                    </marker>
                    <marker id="arrow-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#ffffff"/>
                    </marker>
                </defs>
                {data.edges.map(e => {
                    const n1 = data.nodes.find(n => n.id === e.from);
                    const n2 = data.nodes.find(n => n.id === e.to);
                    if (!n1 || !n2) return null;
                    const isSel = selectedId === e.id;
                    return (
                        <path 
                            key={e.id} 
                            d={getPath(n1.x+NODE_WIDTH, n1.y+NODE_HEIGHT/2, n2.x, n2.y+NODE_HEIGHT/2)} 
                            stroke={isSel ? '#fff' : (e.color || '#71717a')} 
                            strokeWidth={isSel ? 3 : 2} 
                            fill="none" 
                            markerEnd={isSel ? "url(#arrow-selected)" : "url(#arrow)"} 
                            className="interactive pointer-events-auto cursor-pointer transition-colors" 
                            onClick={(ev) => { ev.stopPropagation(); setSelectedId(e.id); }} 
                        />
                    );
                })}
                {mode === 'connect' && connectingSourceId && (() => {
                    const n1 = data.nodes.find(n => n.id === connectingSourceId);
                    if (!n1) return null;
                    return (
                         <path 
                            d={getPath(n1.x+NODE_WIDTH, n1.y+NODE_HEIGHT/2, mousePos.x, mousePos.y)} 
                            stroke="#fff" 
                            strokeWidth="2" 
                            strokeDasharray="5,5"
                            fill="none" 
                        />
                    );
                })()}
            </svg>

            {/* Nodes */}
            {data.nodes.map(node => {
                const config = NODE_CONFIG[node.type] || NODE_CONFIG['note'];
                const Icon = config.icon;
                const isSel = selectedId === node.id;
                const isConnecting = connectingSourceId === node.id;

                return (
                <div 
                     key={node.id} 
                     className={`
                        interactive absolute flex flex-col border backdrop-blur-md rounded-xl overflow-hidden shadow-lg transition-all group/node
                        ${isSel ? 'shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'shadow-black/50'}
                     `}
                     style={{ 
                         left: node.x, 
                         top: node.y, 
                         width: NODE_WIDTH, 
                         minHeight: NODE_HEIGHT, 
                         height: 'auto',
                         borderColor: isSel || isConnecting ? '#fff' : (node.color || config.color), 
                         backgroundColor: '#09090be6', 
                         borderWidth: isSel ? 2 : 1,
                         zIndex: isSel ? 10 : 1
                     }}
                     onMouseDown={(e) => { 
                         if(!readOnly && mode !== 'connect'){ 
                             e.stopPropagation(); 
                             draggingNodeId.current = node.id; 
                             initialNodePos.current = {x:node.x, y:node.y}; 
                             dragStart.current={x:e.clientX, y:e.clientY}; 
                             setSelectedId(node.id); 
                         }
                     }}
                     onClick={(e) => handleNodeClick(e, node.id)}
                     onDoubleClick={() => !readOnly && setEditingNode(node)}
                >
                    {/* Node Header */}
                    <div className="h-7 px-2 flex items-center justify-between border-b border-white/5 bg-white/5 cursor-grab active:cursor-grabbing">
                        <div className="flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5" style={{ color: node.color || config.color }} />
                            <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">{config.label}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setAttachingNodeId(node.id); 
                                  fileInputRef.current?.click(); // Trigger local file input
                                }} 
                                className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
                                title="Attach Image"
                            >
                                <ImageIcon className="w-3 h-3"/>
                            </button>
                        </div>
                    </div>
                    
                    {/* Node Content */}
                    <div className="p-3 flex-1 flex flex-col">
                        <div className="font-bold text-sm text-white mb-1 leading-tight line-clamp-2">{node.label}</div>
                        <div className="text-[10px] text-zinc-400 line-clamp-3 font-mono leading-relaxed mb-2">{node.content || "Double click to edit..."}</div>
                        
                        {/* Attachments Section */}
                        {node.attachments && node.attachments.length > 0 && (
                            <div className="mt-auto pt-2 border-t border-white/5 flex flex-col gap-2">
                                {/* Visual Images */}
                                <div className="grid grid-cols-2 gap-1.5">
                                    {node.attachments.filter(a => a.type === 'image').map((att, i) => (
                                        <div key={i} className="relative aspect-video bg-black rounded overflow-hidden border border-zinc-700 group/img">
                                            <img src={`data:${att.mime};base64,${att.data}`} className="w-full h-full object-cover" alt="attachment" />
                                            {!readOnly && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); removeAttachment(node.id, att.id); }}
                                                    className="absolute top-0.5 right-0.5 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover/img:opacity-100 hover:bg-red-500 transition-all"
                                                >
                                                    <X className="w-2 h-2"/>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {/* Other files (e.g. text/pdf) if any mixed in */}
                                <div className="flex flex-wrap gap-1.5">
                                    {node.attachments.filter(a => a.type !== 'image').map((att, i) => (
                                        <div key={i} className="flex items-center gap-1 pl-1.5 pr-2 py-0.5 bg-zinc-800 rounded border border-zinc-700 max-w-full" title={att.name}>
                                            <FileText className="w-2.5 h-2.5 text-blue-400 shrink-0"/>
                                            <span className="text-[9px] text-zinc-300 truncate max-w-[120px]">{att.name}</span>
                                            {!readOnly && (
                                              <button onClick={(e) => { e.stopPropagation(); removeAttachment(node.id, att.id); }} className="ml-1 text-zinc-500 hover:text-red-400">
                                                <X className="w-2 h-2"/>
                                              </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Connection Handle (Visual only) */}
                    <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-zinc-800 rounded-l transition-opacity ${isSel ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                </div>
            )})}
        </div>
      </div>
      
      {/* --- UI OVERLAYS --- */}
      
      {/* 1. Main Toolbar (Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-xl shadow-2xl interactive z-20 pointer-events-auto">
         <div className="flex items-center gap-1 pr-2 border-r border-zinc-800">
             <button onClick={() => addNode('concept')} className="p-2 text-cyan-400 hover:bg-cyan-950/30 rounded-lg transition-colors" title="Add Concept">
                 <Lightbulb className="w-5 h-5"/>
             </button>
             <button onClick={() => addNode('process')} className="p-2 text-purple-400 hover:bg-purple-950/30 rounded-lg transition-colors" title="Add Process">
                 <Settings2 className="w-5 h-5"/>
             </button>
             <button onClick={() => addNode('note')} className="p-2 text-yellow-400 hover:bg-yellow-950/30 rounded-lg transition-colors" title="Add Note">
                 <StickyNote className="w-5 h-5"/>
             </button>
         </div>

         <button 
            onClick={() => { setMode(mode === 'connect' ? 'select' : 'connect'); setConnectingSourceId(null); }}
            className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${mode === 'connect' ? 'bg-zinc-100 text-black' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
            title="Toggle Connection Mode"
         >
             <ArrowRight className="w-5 h-5"/>
         </button>

         <div className="w-px h-6 bg-zinc-800 mx-1"/>

         <button onClick={runAutoLayout} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Auto Layout (Hierarchical)">
             <LayoutIcon className="w-5 h-5"/>
         </button>
      </div>

      {/* 2. Zoom Controls (Bottom Right) */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-1 interactive z-20 pointer-events-auto">
         <div className="flex flex-col bg-[#09090b] rounded-lg border border-zinc-800 overflow-hidden shadow-xl">
             <button onClick={() => setZoom(z => Math.min(z + 0.1, 5))} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800"><Plus className="w-4 h-4"/></button>
             <div className="h-px bg-zinc-800 w-full"/>
             <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800"><Minus className="w-4 h-4"/></button>
         </div>
         <button onClick={() => { setZoom(1); setOffset({x:0,y:0}); }} className="p-2 bg-[#09090b] text-zinc-400 hover:text-white border border-zinc-800 rounded-lg shadow-xl"><Maximize className="w-4 h-4"/></button>
      </div>

      {/* 3. Selection Actions (Top Left when selected) */}
      {selectedId && !readOnly && (
          <div className="absolute top-6 left-6 flex items-center gap-2 p-1.5 bg-[#09090b] border border-zinc-800 rounded-lg shadow-xl interactive animate-in fade-in slide-in-from-top-2 z-20 pointer-events-auto">
              <span className="text-[10px] uppercase font-bold text-zinc-500 px-2">Selected</span>
              <div className="w-px h-4 bg-zinc-800"/>
              {editingNode && editingNode.id === selectedId ? (
                   <span className="text-xs text-zinc-300 px-2">Editing...</span>
              ) : (
                  <>
                    <button onClick={() => { const n = data.nodes.find(x=>x.id===selectedId); if(n) setEditingNode(n); }} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded"><Edit3 className="w-4 h-4"/></button>
                    {data.nodes.find(n=>n.id===selectedId) && (
                        <button onClick={() => { setMode('connect'); setConnectingSourceId(selectedId); }} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded"><ArrowRight className="w-4 h-4"/></button>
                    )}
                    <button onClick={deleteSelected} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded"><Trash2 className="w-4 h-4"/></button>
                  </>
              )}
          </div>
      )}

      {/* 4. Edit Modal */}
      {editingNode && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 interactive pointer-events-auto">
             <div className="w-full max-w-md bg-[#09090b] border border-zinc-800 rounded-xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
                 <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-cyan-500"/> Edit Node
                    </h3>
                    <button onClick={() => setEditingNode(null)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
                 </div>
                 
                 <div className="space-y-3">
                     <div>
                        <label className="text-xs text-zinc-500 font-bold uppercase block mb-1">Label</label>
                        <input 
                            value={editingNode.label} 
                            onChange={e => setEditingNode({...editingNode, label: e.target.value})} 
                            className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                            placeholder="Node Title"
                            autoFocus
                        />
                     </div>
                     <div>
                        <label className="text-xs text-zinc-500 font-bold uppercase block mb-1">Details</label>
                        <textarea 
                            value={editingNode.content||''} 
                            onChange={e => setEditingNode({...editingNode, content: e.target.value})} 
                            className="w-full h-32 bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                            placeholder="Add detailed notes here..."
                        />
                     </div>
                     
                     <div className="flex gap-2 pt-2">
                        {['concept', 'process', 'note'].map(t => (
                            <button 
                                key={t}
                                onClick={() => setEditingNode({...editingNode, type: t as any, color: NODE_CONFIG[t].color})}
                                className={`flex-1 py-2 rounded-lg border text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${editingNode.type === t ? 'bg-zinc-800 border-white text-white' : 'bg-transparent border-zinc-800 text-zinc-500 hover:bg-zinc-900'}`}
                            >
                                {t}
                            </button>
                        ))}
                     </div>
                 </div>

                 <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                     <button onClick={() => setEditingNode(null)} className="px-4 py-2 text-zinc-400 text-xs font-bold uppercase hover:text-white">Cancel</button>
                     <button 
                        onClick={() => { 
                            onUpdate({...data, nodes: data.nodes.map(n => n.id===editingNode.id?editingNode:n)}); 
                            setEditingNode(null); 
                        }} 
                        className="px-6 py-2 bg-white text-black rounded-lg text-xs font-bold uppercase hover:bg-zinc-200"
                     >
                        Save Changes
                     </button>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
};
