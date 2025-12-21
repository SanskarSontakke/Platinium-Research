
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CanvasData, CanvasNode, CanvasEdge, Attachment } from '../types';
import { 
  Move, Minus, Plus, Maximize, Lock, Unlock, GripHorizontal, Box, X, 
  Palette, Edit3, Type, FileText, Link as LinkIcon, MousePointer2, 
  Trash2, Lightbulb, Settings2, StickyNote, Paperclip, Image as ImageIcon,
  ArrowRight, Layout as LayoutIcon, RefreshCw, Zap, Upload, ZoomIn, ZoomOut, MousePointerSquareDashed,
  Undo, Redo, Hexagon
} from 'lucide-react';

interface CanvasBoardProps {
  data: CanvasData;
  onUpdate: (newData: CanvasData) => void;
  onAttachFiles?: (nodeId: string) => void; 
  readOnly?: boolean;
}

const GRID_SIZE = 25;
const NODE_WIDTH = 240; 
const NODE_HEIGHT = 160;
const ZOOM_SENSITIVITY = 0.001;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;

const NODE_CONFIG: Record<CanvasNode['type'], { 
  icon: any, 
  color: string, 
  secondaryColor: string, 
  label: string,
  shapeClass: string,
  iconSize: string
}> = {
  concept: { 
    icon: Lightbulb, 
    color: '#22d3ee', 
    secondaryColor: 'rgba(6, 182, 212, 0.15)', 
    label: 'Concept',
    shapeClass: 'rounded-full',
    iconSize: 'w-4 h-4'
  },
  process: { 
    icon: Settings2, 
    color: '#c084fc', 
    secondaryColor: 'rgba(168, 85, 247, 0.15)', 
    label: 'Process',
    shapeClass: 'rounded-lg rotate-45',
    iconSize: 'w-4 h-4 -rotate-45'
  }, 
  note: { 
    icon: StickyNote, 
    color: '#fbbf24', 
    secondaryColor: 'rgba(234, 179, 8, 0.15)', 
    label: 'Note',
    shapeClass: 'rounded-md',
    iconSize: 'w-4 h-4'
  },  
};

export const CanvasBoard: React.FC<CanvasBoardProps> = ({ data, onUpdate, onAttachFiles, readOnly = false }) => {
  const [localNodes, setLocalNodes] = useState<CanvasNode[]>(data.nodes);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<'select' | 'connect'>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingCanvas = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const draggingNodeId = useRef<string | null>(null);
  const initialNodePos = useRef({ x: 0, y: 0 });

  const [history, setHistory] = useState<CanvasData[]>([data]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isInternalAction = useRef(false);

  useEffect(() => {
    if (!draggingNodeId.current) setLocalNodes(data.nodes);

    if (isInternalAction.current) {
        isInternalAction.current = false;
        return;
    }

    const currentStored = history[historyIndex];
    if (JSON.stringify(currentStored) !== JSON.stringify(data)) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(data);
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }
  }, [data]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isInternalAction.current = true;
      const prevState = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onUpdate(prevState);
      setSelectedId(null);
      setEditingNodeId(null);
    }
  }, [history, historyIndex, onUpdate]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isInternalAction.current = true;
      const nextState = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onUpdate(nextState);
    }
  }, [history, historyIndex, onUpdate]);

  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - offset.x) / zoom,
      y: (screenY - rect.top - offset.y) / zoom
    };
  }, [offset, zoom]);

  const handleZoom = useCallback((delta: number, centerX?: number, centerY?: number) => {
    setZoom(prevZoom => {
      const newZoom = Math.min(Math.max(prevZoom * (1 + delta), MIN_ZOOM), MAX_ZOOM);
      
      if (centerX !== undefined && centerY !== undefined && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = centerX - rect.left;
        const mouseY = centerY - rect.top;

        const worldX = (mouseX - offset.x) / prevZoom;
        const worldY = (mouseY - offset.y) / prevZoom;

        const newOffsetX = mouseX - worldX * newZoom;
        const newOffsetY = mouseY - worldY * newZoom;
        
        setOffset({ x: newOffsetX, y: newOffsetY });
      }
      
      return newZoom;
    });
  }, [offset]);

  const resetView = useCallback(() => {
    setOffset({ x: 100, y: 100 });
    setZoom(1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === '+' || e.key === '=') {
        handleZoom(0.1);
      } else if (e.key === '-') {
        handleZoom(-0.1);
      } else if (e.key === '0') {
        resetView();
      } else if (e.key === 'Escape') {
        setMode('select');
        setConnectingSourceId(null);
        setSelectedId(null);
        setEditingNodeId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoom, resetView, undo, redo]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      handleZoom(delta, e.clientX, e.clientY);
    } else {
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addNode = (type: keyof typeof NODE_CONFIG) => {
      if (readOnly) return;
      const worldPos = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
      const newNode: CanvasNode = {
          id: generateId(),
          type,
          label: `New ${NODE_CONFIG[type].label}`,
          content: '',
          x: worldPos.x - NODE_WIDTH / 2,
          y: worldPos.y - NODE_HEIGHT / 2,
          color: NODE_CONFIG[type].color
      };
      const newNodes = [...localNodes, newNode];
      onUpdate({ ...data, nodes: newNodes });
      setSelectedId(newNode.id);
      setEditingNodeId(newNode.id);
  };

  const deleteSelected = () => {
    if (readOnly || !selectedId) return;
    const newNodes = localNodes.filter(n => n.id !== selectedId);
    const newEdges = data.edges.filter(e => e.id !== selectedId && e.from !== selectedId && e.to !== selectedId);
    onUpdate({ nodes: newNodes, edges: newEdges });
    setSelectedId(null);
    setEditingNodeId(null);
  };

  const runAutoLayout = () => {
      if (localNodes.length === 0) return;
      
      const nodes = [...localNodes];
      const edges = data.edges;
      const ranks: Record<string, number> = {};
      const layerCounts: Record<number, number> = {};
      const totalInRank: Record<number, number> = {};

      nodes.forEach(n => ranks[n.id] = 0);

      for (let i = 0; i < Math.min(nodes.length, 30); i++) {
          edges.forEach(e => {
              if (ranks[e.to] <= ranks[e.from]) {
                  ranks[e.to] = ranks[e.from] + 1;
              }
          });
      }

      nodes.forEach(n => {
          const r = ranks[n.id];
          totalInRank[r] = (totalInRank[r] || 0) + 1;
      });

      const HORIZONTAL_GAP = 700;
      const VERTICAL_GAP = 450;

      const newNodes = nodes.map(n => {
          const r = ranks[n.id];
          const indexInRank = layerCounts[r] || 0;
          layerCounts[r] = indexInRank + 1;
          const yOffset = (indexInRank - (totalInRank[r] - 1) / 2) * VERTICAL_GAP;
          return { ...n, x: r * HORIZONTAL_GAP, y: yOffset };
      });

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      newNodes.forEach(n => {
          minX = Math.min(minX, n.x);
          maxX = Math.max(maxX, n.x + NODE_WIDTH);
          minY = Math.min(minY, n.y);
          maxY = Math.max(maxY, n.y + NODE_HEIGHT);
      });

      const graphWidth = maxX - minX;
      const graphHeight = maxY - minY;
      const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
      const containerHeight = containerRef.current?.clientHeight || window.innerHeight;

      const targetZoom = Math.min(
          Math.max((containerWidth - 200) / graphWidth, MIN_ZOOM),
          Math.max((containerHeight - 200) / graphHeight, MIN_ZOOM),
          0.7
      );

      const centerX = (containerWidth / 2) - ((minX + graphWidth / 2) * targetZoom);
      const centerY = (containerHeight / 2) - ((minY + graphHeight / 2) * targetZoom);

      onUpdate({ ...data, nodes: newNodes });
      setZoom(targetZoom);
      setOffset({ x: centerX, y: centerY });
  };

  const startConnection = (e: React.MouseEvent, nodeId: string) => {
    if (readOnly) return;
    e.stopPropagation();
    setConnectingSourceId(nodeId);
    setMousePos(screenToWorld(e.clientX, e.clientY));
  };

  const getPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dist = Math.abs(x2 - x1);
    const controlDist = Math.max(dist * 0.5, 120); 
    return `M ${x1} ${y1} C ${x1 + controlDist} ${y1}, ${x2 - controlDist} ${y2}, ${x2} ${y2}`;
  };

  const activeNode = localNodes.find(n => n.id === editingNodeId);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-[#050505] overflow-hidden select-none group font-sans outline-none"
      onWheel={handleWheel}
      tabIndex={0}
      style={{ containerType: 'inline-size' } as any}
    >
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-75"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #1e1e1e 1px, transparent 0)`,
          backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`
        }}
      />

      <div className="absolute top-8 left-8 z-50 flex flex-col p-1.5 bg-[#0c0c0e]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] animate-fade-in-up no-scrollbar shrink-0">
          <div className="flex flex-col items-center gap-1.5 p-1.5 border-b border-white/10 shrink-0">
              <ToolbarButton icon={Lightbulb} label="Concept" onClick={() => addNode('concept')} color="text-cyan-400" />
              <ToolbarButton icon={Settings2} label="Process" onClick={() => addNode('process')} color="text-purple-400" />
              <ToolbarButton icon={StickyNote} label="Note" onClick={() => addNode('note')} color="text-amber-400" />
          </div>
          
          <div className="flex flex-col items-center gap-1.5 p-1.5 border-b border-white/10 shrink-0">
              <ToolbarButton 
                  icon={ArrowRight} 
                  label="Connect" 
                  onClick={() => setMode(mode === 'connect' ? 'select' : 'connect')} 
                  active={mode === 'connect'}
                  color="text-zinc-300"
              />
              <ToolbarButton icon={LayoutIcon} label="Auto Layout" onClick={runAutoLayout} color="text-zinc-300" />
              <ToolbarButton icon={Undo} label="Undo" onClick={undo} disabled={historyIndex <= 0} color="text-zinc-300" />
              <ToolbarButton icon={Redo} label="Redo" onClick={redo} disabled={historyIndex >= history.length - 1} color="text-zinc-300" />
          </div>
          
          <div className="flex flex-col items-center gap-1.5 p-1.5 shrink-0">
              <ToolbarButton icon={RefreshCw} label="Reset View" onClick={resetView} color="text-zinc-300" />
              <ToolbarButton icon={Trash2} label="Delete Selected" onClick={deleteSelected} disabled={!selectedId} color="text-red-500" />
          </div>
      </div>

      <div className="absolute bottom-8 left-8 z-50 flex flex-col gap-2 p-1.5 bg-[#09090b]/90 backdrop-blur-xl border border-white/5 rounded-xl shadow-2xl">
          <button onClick={() => handleZoom(0.1)} className="p-2 hover:bg-zinc-800 rounded-lg transition-all active:scale-90 text-zinc-400 hover:text-white" title="Zoom In (+)"><ZoomIn className="w-5 h-5"/></button>
          <div className="h-px bg-zinc-800/50 mx-1.5" />
          <button onClick={() => handleZoom(-0.1)} className="p-2 hover:bg-zinc-800 rounded-lg transition-all active:scale-90 text-zinc-400 hover:text-white" title="Zoom Out (-)"><ZoomOut className="w-5 h-5"/></button>
      </div>

      <div 
        className="w-full h-full outline-none"
        style={{ cursor: isDraggingCanvas.current ? 'grabbing' : connectingSourceId ? 'crosshair' : 'grab' }}
        onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('.interactive')) return;
            isDraggingCanvas.current = true;
            dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
            setSelectedId(null);
            setEditingNodeId(null);
        }}
        onMouseMove={(e) => {
            if (isDraggingCanvas.current) {
                setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
                return;
            } 
            if (draggingNodeId.current && !readOnly) {
                 const deltaX = (e.clientX - dragStart.current.x) / zoom;
                 const deltaY = (e.clientY - dragStart.current.y) / zoom;
                 setLocalNodes(prev => prev.map(n => n.id === draggingNodeId.current 
                    ? { ...n, x: initialNodePos.current.x + deltaX, y: initialNodePos.current.y + deltaY } 
                    : n));
                 return;
            }
            if (connectingSourceId) setMousePos(screenToWorld(e.clientX, e.clientY));
        }}
        onMouseUp={() => { 
            if (isDraggingCanvas.current) isDraggingCanvas.current = false; 
            if (draggingNodeId.current) {
                onUpdate({ ...data, nodes: localNodes });
                draggingNodeId.current = null;
            }
            if (connectingSourceId) {
                if (hoveredNodeId && hoveredNodeId !== connectingSourceId) {
                    const exists = data.edges.some(e => e.from === connectingSourceId && e.to === hoveredNodeId);
                    if (!exists) {
                        const newEdge: CanvasEdge = { id: generateId(), from: connectingSourceId, to: hoveredNodeId, color: '#71717a' };
                        onUpdate({ ...data, edges: [...data.edges, newEdge] });
                    }
                }
                setConnectingSourceId(null);
                setHoveredNodeId(null);
            }
        }}
      >
        <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
            <svg className="absolute top-0 left-0 overflow-visible pointer-events-none">
                <defs>
                    <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#3f3f46"/>
                    </marker>
                    <marker id="arrow-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#22d3ee"/>
                    </marker>
                </defs>
                {data.edges.map(e => {
                    const n1 = localNodes.find(n => n.id === e.from);
                    const n2 = localNodes.find(n => n.id === e.to);
                    if (!n1 || !n2) return null;
                    const isSel = selectedId === e.id;
                    return (
                        <path 
                            key={e.id} 
                            d={getPath(n1.x + NODE_WIDTH, n1.y + NODE_HEIGHT/2, n2.x, n2.y + NODE_HEIGHT/2)} 
                            stroke={isSel ? '#22d3ee' : '#3f3f46'} 
                            strokeWidth={isSel ? 3 : 2} 
                            fill="none" 
                            markerEnd={isSel ? "url(#arrow-selected)" : "url(#arrow)"} 
                            className="interactive pointer-events-auto cursor-pointer transition-colors hover:stroke-zinc-500" 
                            onClick={(ev) => { ev.stopPropagation(); setSelectedId(e.id); }} 
                        />
                    );
                })}
                {connectingSourceId && (() => {
                    const n1 = localNodes.find(n => n.id === connectingSourceId);
                    const nTarget = localNodes.find(n => n.id === hoveredNodeId);
                    if (!n1) return null;
                    
                    // Visual snapping to hovered node input port
                    const targetX = nTarget ? nTarget.x : mousePos.x;
                    const targetY = nTarget ? nTarget.y + NODE_HEIGHT / 2 : mousePos.y;

                    return (
                         <path 
                            d={getPath(n1.x + NODE_WIDTH, n1.y + NODE_HEIGHT/2, targetX, targetY)} 
                            stroke="#22d3ee" 
                            strokeWidth="2" 
                            strokeDasharray="6,4"
                            fill="none" 
                        />
                    );
                })()}
            </svg>

            {localNodes.map(node => {
                const config = NODE_CONFIG[node.type] || NODE_CONFIG['note'];
                const Icon = config.icon;
                const isSel = selectedId === node.id;
                const isTargetHovered = hoveredNodeId === node.id && connectingSourceId !== node.id;
                const nodeColor = node.color || config.color;
                const secondaryColor = config.secondaryColor;

                return (
                <div 
                     key={node.id} 
                     className={`interactive absolute flex flex-col border backdrop-blur-md rounded-2xl transition-all duration-300 ${isSel ? 'shadow-[0_0_50px_rgba(255,255,255,0.1)] z-20 scale-105' : 'shadow-2xl z-10'} ${isTargetHovered ? 'ring-4 ring-cyan-500/30' : ''}`}
                     style={{ 
                         left: node.x, top: node.y, width: NODE_WIDTH, minHeight: NODE_HEIGHT,
                         borderColor: isSel ? '#fff' : isTargetHovered ? '#22d3ee' : nodeColor, 
                         backgroundColor: '#0c0c0e/95', 
                         borderWidth: isSel || isTargetHovered ? 2 : 1,
                     }}
                     onMouseEnter={() => { if (connectingSourceId) setHoveredNodeId(node.id); }}
                     onMouseLeave={() => { if (connectingSourceId) setHoveredNodeId(null); }}
                     onMouseDown={(e) => { 
                         if(!readOnly && mode !== 'connect'){ 
                             e.stopPropagation(); 
                             draggingNodeId.current = node.id; 
                             initialNodePos.current = {x:node.x, y:node.y}; 
                             dragStart.current={x:e.clientX, y:e.clientY}; 
                             setSelectedId(node.id); 
                         }
                     }}
                     onDoubleClick={() => setEditingNodeId(node.id)}
                >
                    {/* Input Port (Left) */}
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-zinc-900 border-2 border-zinc-700 z-30 group/port">
                        <div className={`absolute inset-0 rounded-full transition-all ${isTargetHovered ? 'bg-cyan-500 scale-125 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-transparent'}`} />
                    </div>

                    {/* Output Port (Right) */}
                    <div 
                        className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-zinc-900 border-2 border-zinc-700 z-30 group/port cursor-crosshair hover:border-cyan-500 transition-colors"
                        onMouseDown={(e) => startConnection(e, node.id)}
                    >
                        <div className="absolute inset-0 rounded-full bg-cyan-500 opacity-0 group-hover/port:opacity-100 scale-75 transition-all" />
                    </div>

                    <div className="h-12 px-3 flex items-center justify-between border-b border-white/5 bg-white/5 rounded-t-2xl">
                        <div className="flex items-center gap-3">
                            <div 
                                className={`w-8 h-8 flex items-center justify-center relative group/icon ${config.shapeClass}`}
                                style={{ backgroundColor: secondaryColor }}
                            >
                                <div 
                                    className={`absolute inset-0 blur-[6px] opacity-50 ${config.shapeClass}`}
                                    style={{ backgroundColor: nodeColor }}
                                />
                                <Icon 
                                    className={`${config.iconSize} relative z-10`} 
                                    style={{ color: nodeColor, fill: nodeColor + '40' }} 
                                    strokeWidth={2.5}
                                />
                            </div>
                            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.15em]">{config.label}</span>
                        </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-2">
                        <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug">{node.label}</h4>
                        <p className="text-[11px] text-zinc-500 line-clamp-4 leading-relaxed font-medium">{node.content || "Double click to edit content..."}</p>
                    </div>
                </div>
                );
            })}
        </div>
      </div>

      {activeNode && (
          <div className="absolute top-0 right-0 h-full w-[360px] bg-[#09090b]/98 backdrop-blur-3xl border-l border-white/10 z-[60] flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in slide-in-from-right duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20"><Edit3 className="w-5 h-5 text-cyan-400" /></div>
                      <div>
                        <h3 className="text-lg font-black tracking-tight text-white">Element Hub</h3>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Node Identity</p>
                      </div>
                  </div>
                  <button onClick={() => setEditingNodeId(null)} className="p-2.5 hover:bg-zinc-800 rounded-xl transition-all text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                  <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-1">Display Title</label>
                      <input 
                          autoFocus
                          value={activeNode.label} 
                          onChange={(e) => {
                              const newNodes = localNodes.map(n => n.id === activeNode.id ? {...n, label: e.target.value} : n);
                              onUpdate({...data, nodes: newNodes});
                          }}
                          className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 text-sm font-medium focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all placeholder:text-zinc-700" 
                          placeholder="e.g. Core Hypothesis"
                      />
                  </div>
                  
                  <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-1">Description / Notes</label>
                      <textarea 
                          rows={8}
                          value={activeNode.content} 
                          onChange={(e) => {
                              const newNodes = localNodes.map(n => n.id === activeNode.id ? {...n, content: e.target.value} : n);
                              onUpdate({...data, nodes: newNodes});
                          }}
                          className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 text-sm font-medium resize-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all leading-relaxed placeholder:text-zinc-700" 
                          placeholder="Deep dive into the details here..."
                      />
                  </div>
                  
                  <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-1 text-center block">Neural Core Color</label>
                      <div className="flex justify-center gap-3">
                          {['#06b6d4', '#a855f7', '#eab308', '#ef4444', '#10b981', '#71717a'].map(c => (
                              <button 
                                  key={c} 
                                  onClick={() => {
                                      const newNodes = localNodes.map(n => n.id === activeNode.id ? {...n, color: c} : n);
                                      onUpdate({...data, nodes: newNodes});
                                  }}
                                  className={`w-9 h-9 rounded-full border-2 transition-all hover:scale-110 active:scale-90 flex items-center justify-center ${activeNode.color === c ? 'border-white ring-4 ring-white/10' : 'border-transparent opacity-60 hover:opacity-100'}`} 
                                  style={{ backgroundColor: c }}
                              >
                                {activeNode.color === c && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="p-8 border-t border-white/5 bg-black/20">
                   <button onClick={deleteSelected} className="group w-full py-4 bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3">
                       <Trash2 className="w-4 h-4" /> Discard Element
                   </button>
              </div>
          </div>
      )}
    </div>
  );
};

const ToolbarButton: React.FC<{ icon: any, label: string, onClick: () => void, active?: boolean, disabled?: boolean, color?: string }> = ({ icon: Icon, label, onClick, active, disabled, color }) => (
    <button 
        onClick={onClick} 
        disabled={disabled}
        className={`w-11 h-11 rounded-xl transition-all active:scale-95 flex items-center justify-center group flex-shrink-0
            ${active ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'hover:bg-white/5 text-zinc-400'}
            ${disabled ? 'opacity-20 cursor-not-allowed' : ''}
        `}
        title={label}
    >
        <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 shrink-0 ${active ? 'text-black' : (color || 'text-zinc-400')}`} />
    </button>
);
