
import React, { useEffect, useRef, useState } from 'react';
import { getLiveClient } from '../services/geminiService';
import { LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Radio, StopCircle, Activity, Volume2, VolumeX, History, Sparkles, PenTool, BrainCircuit, Grid, Zap, MessageSquare } from 'lucide-react';
import { updateDraftTool, generateCanvasTool, manageTablesTool, searchTool } from '../services/agent/tools';
import { CanvasData, Table } from '../types';

interface LiveBrainstormProps {
  projectContext: {
    projectId: string;
    assetsFolderId?: string;
    draftContent: string;
    canvasData?: CanvasData;
    tables: Table[];
  };
  history: { role: 'user' | 'ai', text: string, id: number }[];
  onUpdateHistory: (history: { role: 'user' | 'ai', text: string, id: number }[]) => void;
  onDraftUpdate: (content: string) => void;
  onCanvasUpdate: (data: CanvasData) => void;
  onTablesUpdate: (tables: Table[]) => void;
}

const LiveBrainstorm: React.FC<LiveBrainstormProps> = ({ 
  projectContext, history, onUpdateHistory, onDraftUpdate, onCanvasUpdate, onTablesUpdate 
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const currentTurnRef = useRef<{ role: 'user' | 'ai', text: string, id: number } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  const lastInputLevel = useRef(0);
  const lastOutputLevel = useRef(0);

  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [history]);

  const isMutedRef = useRef(isMuted);
  useEffect(() => { 
    isMutedRef.current = isMuted; 
    if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => track.enabled = !isMuted);
    }
  }, [isMuted]);

  useEffect(() => {
    if (gainNodeRef.current && outputAudioContextRef.current) {
      const targetTime = outputAudioContextRef.current.currentTime;
      gainNodeRef.current.gain.setTargetAtTime(volume, targetTime, 0.02);
    }
  }, [volume]);

  const createBlob = (data: Float32Array): any => {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' };
  };

  const decodeAudioData = async (base64: string, ctx: AudioContext): Promise<AudioBuffer> => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    return buffer;
  };

  const drawVisualizer = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) / 3.8;

    ctx.clearRect(0, 0, width, height);

    const getLevel = (analyser: AnalyserNode | null) => {
      if (!analyser) return 0;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      let values = 0;
      for (let i = 0; i < data.length; i++) values += data[i];
      return values / data.length;
    };

    const outLevel = getLevel(outputAnalyserRef.current);
    const inLevel = isMutedRef.current ? 0 : getLevel(inputAnalyserRef.current);

    lastOutputLevel.current = lastOutputLevel.current * 0.8 + outLevel * 0.2;
    lastInputLevel.current = lastInputLevel.current * 0.8 + inLevel * 0.2;

    const drawFluidWave = (
      analyser: AnalyserNode | null, 
      color: string, 
      level: number, 
      layerOffset: number, 
      complexity: number,
      opacity: number
    ) => {
      if (!analyser) return;
      const bufferLength = analyser.frequencyBinCount;
      const freqData = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(freqData);

      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.globalAlpha = opacity;
      
      const points = 180;
      const angleStep = (Math.PI * 2) / points;
      const time = performance.now() * 0.001;
      
      for (let i = 0; i <= points; i++) {
        const angle = i * angleStep;
        const idx = Math.floor((i % points) * (bufferLength / points));
        
        const freqValue = freqData[idx] / 255;
        const noise = Math.sin(angle * complexity + time * 2) * 10;
        const wobble = Math.cos(angle * 3 + time * 4) * (level * 0.2);
        
        const r = baseRadius + layerOffset + (freqValue * level * 0.8) + noise + wobble;
        
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      
      ctx.closePath();
      ctx.stroke();
      
      if (level > 2) {
        ctx.fillStyle = color.replace('0.85', '0.05');
        ctx.fill();
      }
      ctx.restore();
    };

    if (outputAnalyserRef.current && status === 'connected') {
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(34, 211, 238, 0.3)';
      drawFluidWave(outputAnalyserRef.current, 'rgba(34, 211, 238, 0.1)', lastOutputLevel.current, 20, 4, 0.4);
      drawFluidWave(outputAnalyserRef.current, 'rgba(34, 211, 238, 0.85)', lastOutputLevel.current, 0, 8, 0.8);
      drawFluidWave(outputAnalyserRef.current, 'rgba(34, 211, 238, 0.4)', lastOutputLevel.current, -15, 12, 0.6);
    }

    if (!isMutedRef.current && inputAnalyserRef.current && status === 'connected') {
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
      drawFluidWave(inputAnalyserRef.current, 'rgba(255, 255, 255, 0.9)', lastInputLevel.current, 40, 32, 0.8);
      drawFluidWave(inputAnalyserRef.current, 'rgba(255, 255, 255, 0.15)', lastInputLevel.current, 45, 6, 0.3);
    }

    if (status !== 'connected') {
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + Math.sin(Date.now() * 0.002) * 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    animationFrameRef.current = requestAnimationFrame(drawVisualizer);
  };

  const connectToLive = async () => {
    try {
      setError(null);
      setStatus('connecting');

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      
      outputAnalyserRef.current = outputCtx.createAnalyser();
      outputAnalyserRef.current.fftSize = 1024;
      outputAnalyserRef.current.smoothingTimeConstant = 0.8;
      
      const gainNode = outputCtx.createGain();
      gainNode.gain.value = volume;
      gainNodeRef.current = gainNode;
      gainNode.connect(outputAnalyserRef.current);
      outputAnalyserRef.current.connect(outputCtx.destination);

      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      inputAnalyserRef.current = inputCtx.createAnalyser();
      inputAnalyserRef.current.fftSize = 1024;
      inputAnalyserRef.current.smoothingTimeConstant = 0.8;
      const micSource = inputCtx.createMediaStreamSource(streamRef.current);
      micSource.connect(inputAnalyserRef.current);

      const liveClient = getLiveClient();
      const sessionPromise = liveClient.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus('connected');
            setIsConnected(true);
            drawVisualizer(); 
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              if (isMutedRef.current) return; 
              sessionPromise.then((s) => {
                  sessionRef.current = s;
                  s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) });
              });
            };
            inputAnalyserRef.current?.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
             if (msg.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => { 
                    try { s.stop(); } catch(e){} 
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
             }

             if (msg.toolCall) {
                for (const fc of msg.toolCall.functionCalls) {
                  let toolResult: any = "ok";
                  const execContext = {
                      ...projectContext,
                      currentBrowserUrl: (window as any).currentBrowserUrl || ''
                  };

                  try {
                    if (fc.name === 'updateDraft') {
                        const res = await updateDraftTool.execute(fc.args as any, execContext);
                        if (res.meta?.content) onDraftUpdate(res.meta.content);
                        toolResult = res.text;
                    } else if (fc.name === 'generateCanvas') {
                        const res = await generateCanvasTool.execute(fc.args as any, execContext);
                        if (res.meta?.canvasData) onCanvasUpdate(res.meta.canvasData);
                        toolResult = res.text;
                    } else if (fc.name === 'manageTables') {
                        const res = await manageTablesTool.execute(fc.args as any, execContext);
                        if (res.meta?.tables) onTablesUpdate(res.meta.tables);
                        toolResult = res.text;
                    } else if (fc.name === 'searchWeb') {
                        const res = await searchTool.execute(fc.args as any, execContext);
                        toolResult = res.text;
                    }
                  } catch (e: any) { toolResult = `Error: ${e.message}`; }

                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: [{ id: fc.id, name: fc.name, response: { result: toolResult } }]
                  }));
                }
             }

             if (msg.serverContent?.inputTranscription || msg.serverContent?.outputTranscription) {
                const role: 'user' | 'ai' = msg.serverContent.inputTranscription ? 'user' : 'ai';
                const text: string = msg.serverContent.inputTranscription?.text || msg.serverContent.outputTranscription?.text || "";
                
                if (currentTurnRef.current && currentTurnRef.current.role === role) {
                   currentTurnRef.current.text += text;
                   const updatedText = currentTurnRef.current.text;
                   onUpdateHistory(history.map(h => currentTurnRef.current && h.id === currentTurnRef.current.id ? { ...h, text: updatedText } : h));
                } else {
                   const newTurn = { role, text, id: Date.now() };
                   currentTurnRef.current = newTurn;
                   onUpdateHistory([...history, newTurn]);
                }
             }
             if (msg.serverContent?.turnComplete) currentTurnRef.current = null;

             const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (audio && outputCtx.state !== 'closed') {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const buffer = await decodeAudioData(audio, outputCtx);
                const source = outputCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(gainNode);
                source.addEventListener('ended', () => sourcesRef.current.delete(source));
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                sourcesRef.current.add(source);
             }
          },
          onclose: () => disconnectLive(),
          onerror: (err) => { setError("Live engine failed to sync."); disconnectLive(); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: [updateDraftTool.definition, generateCanvasTool.definition, manageTablesTool.definition, searchTool.definition] }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are Platinium, the lead Research Architect. You are now in a LIVE VOICE BRAINSTORM session. 
          You share the exact same context, memory, and project state as the chat agent. 
          If the user speaks to you, respond naturally and intelligently. 
          You have full control over the workspace: 
          - If asked to write or update, use 'updateDraft'.
          - If asked to map or diagram, use 'generateCanvas'.
          - If asked for data tables, use 'manageTables'.
          Keep spoken responses relatively concise. If the user interrupts you, stop immediately and listen.`
        }
      });
    } catch (err: any) {
      setError(err.message || "Failed to start Live Brainstorm.");
      setStatus('disconnected');
    }
  };

  const disconnectLive = () => {
    if (sessionRef.current) try { sessionRef.current.close(); } catch (e) {}
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') inputAudioContextRef.current.close().catch(()=>{});
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') outputAudioContextRef.current.close().catch(()=>{});
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setStatus('disconnected');
    setIsConnected(false);
    sessionRef.current = null;
    gainNodeRef.current = null;
    lastInputLevel.current = 0;
    lastOutputLevel.current = 0;
  };

  useEffect(() => () => disconnectLive(), []);

  return (
    <div className="flex h-full bg-[#050505] text-white p-8 relative overflow-hidden font-sans">
      <div className={`absolute inset-0 transition-all duration-1000 opacity-20 pointer-events-none ${status === 'connected' ? 'bg-[radial-gradient(circle_at_25%_50%,_var(--tw-gradient-stops))] from-cyan-950 via-black to-black' : ''}`} />

      <div className="flex w-full h-full gap-8 z-10 animate-fade-in relative">
        
        {/* LEFT COLUMN: Circular Visualizer & Bottom Controls (Compact for better space distribution) */}
        <div className="flex-none w-[380px] flex flex-col items-center justify-between pb-6">
           
           <div className="w-full space-y-4 text-center">
              <div className="flex items-center justify-center gap-3">
                <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.9)]' : 'bg-zinc-800'}`} />
                <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-500">Neuro-Sync Engine</h2>
              </div>
              
              <div className="relative flex items-center justify-center w-[360px] h-[360px] mx-auto group">
                 <div className={`absolute inset-0 rounded-full border border-white/5 transition-all duration-[2000ms] ${status === 'connected' ? 'scale-105 opacity-100' : 'scale-90 opacity-20'}`} />
                 <canvas ref={canvasRef} width={500} height={500} className="w-[120%] h-[120%] pointer-events-none absolute" />
                 <div className={`w-28 h-28 rounded-full flex items-center justify-center bg-black border border-zinc-800 shadow-[0_0_60px_rgba(0,0,0,0.6)] transition-all duration-1000 ${status === 'connected' ? 'opacity-100 scale-100' : 'opacity-40 scale-90'}`}>
                    {status === 'connected' ? (
                      <div className="relative">
                        <Sparkles className="w-10 h-10 text-cyan-400 animate-pulse" />
                        <div className="absolute inset-0 blur-lg bg-cyan-400/20 rounded-full animate-ping" />
                      </div>
                    ) : (
                      <Activity className="w-10 h-10 text-zinc-700" />
                    )}
                 </div>
              </div>
           </div>

           <div className="bg-[#0c0c0e]/70 backdrop-blur-3xl p-8 rounded-[3rem] border border-white/[0.04] space-y-8 shadow-2xl w-full">
              <div className="flex flex-col gap-4 px-4">
                  <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500">
                      <span>Gain Level</span>
                      <span className={`transition-all duration-300 ${volume > 0 ? 'text-cyan-400' : 'text-zinc-700'}`}>{Math.round(volume * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                     <VolumeX className={`w-4 h-4 transition-colors ${volume === 0 ? 'text-red-500' : 'text-zinc-700'}`} />
                     <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.01" 
                        value={volume} 
                        onChange={(e) => setVolume(parseFloat(e.target.value))} 
                        className="flex-1 h-1 rounded-full appearance-none cursor-pointer hover:bg-zinc-800 transition-all accent-cyan-400"
                        style={{ background: `linear-gradient(to right, #22d3ee ${volume * 100}%, #18181b ${volume * 100}%)` }}
                     />
                     <Volume2 className={`w-4 h-4 transition-colors ${volume > 0.7 ? 'text-cyan-400' : 'text-zinc-700'}`} />
                  </div>
              </div>

              <div className="flex flex-col gap-4">
                {status !== 'connected' ? (
                  <button 
                    onClick={connectToLive} 
                    disabled={status === 'connecting'} 
                    className="group w-full flex items-center justify-center gap-4 px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-[0.4em] transition-all text-[11px] active:scale-95 disabled:opacity-50 shadow-[0_20px_40px_rgba(255,255,255,0.05)]"
                  >
                    <Radio className={`w-4 h-4 ${status === 'connecting' ? 'animate-spin text-zinc-400' : 'animate-pulse text-zinc-900'}`} />
                    {status === 'connecting' ? 'Calibrating' : 'Sync Engine'}
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setIsMuted(!isMuted)} 
                        className={`flex items-center justify-center gap-3 py-4 rounded-xl font-black uppercase tracking-widest transition-all border text-[10px] active:scale-95 ${isMuted ? 'bg-red-950/20 border-red-900/40 text-red-500' : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white'}`}
                    >
                      {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      {isMuted ? 'Muted' : 'Live'}
                    </button>
                    <button 
                        onClick={disconnectLive} 
                        className="flex items-center justify-center gap-3 py-4 bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white rounded-xl font-black uppercase tracking-widest transition-all text-[10px] active:scale-95 hover:bg-red-600/20 hover:border-red-500/40"
                    >
                      <StopCircle className="w-4 h-4" /> Stop
                    </button>
                  </div>
                )}
              </div>
           </div>
        </div>

        {/* MIDDLE/RIGHT COLUMN: High-Visibility Transcription History (Flexible growth) */}
        <div className="flex-1 flex flex-col bg-[#08080a]/50 backdrop-blur-md rounded-[3rem] border border-white/[0.03] p-10 overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.6)] animate-fade-in-up">
           <div className="flex items-center justify-between mb-8 pb-8 border-b border-white/[0.02] shrink-0">
              <div className="flex items-center gap-4">
                 <div className="p-2.5 bg-zinc-900/40 rounded-xl border border-white/5"><History className="w-5 h-5 text-zinc-500" /></div>
                 <div>
                    <span className="text-[11px] font-black text-zinc-200 uppercase tracking-[0.4em] block">Brainstorm Stream</span>
                    <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5 block">Shared Project Workspace Context</span>
                 </div>
              </div>
              <div className="flex items-center gap-8 opacity-40 hover:opacity-100 transition-all duration-700">
                 <div className="flex items-center gap-3"><PenTool className="w-4 h-4 text-emerald-500"/> <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Draft</span></div>
                 <div className="flex items-center gap-3"><BrainCircuit className="w-4 h-4 text-purple-500"/> <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Canvas</span></div>
                 <div className="flex items-center gap-3"><Grid className="w-4 h-4 text-cyan-500"/> <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Data</span></div>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto custom-scrollbar space-y-12 pr-6 scroll-smooth">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-900 space-y-6">
                    <Zap className="w-20 h-20 opacity-5 animate-pulse" />
                    <p className="text-[10px] uppercase font-black tracking-[0.6em] opacity-30">Awaiting Neural Link</p>
                </div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="flex gap-10 group animate-fade-in-up">
                      <div className="w-12 shrink-0 flex flex-col items-center gap-4 mt-1.5">
                         <div className={`text-[9px] font-black uppercase tracking-tighter px-2.5 py-1 rounded-lg ${item.role === 'user' ? 'text-zinc-600 bg-zinc-900/40' : 'text-cyan-500 bg-cyan-950/20 border border-cyan-500/10'}`}>
                            {item.role === 'user' ? 'USER' : 'PLAT'}
                         </div>
                         <div className={`w-[1px] flex-1 rounded-full ${item.role === 'user' ? 'bg-zinc-900/40' : 'bg-cyan-950/40'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[16px] text-zinc-400 font-medium leading-[1.8] tracking-tight group-hover:text-zinc-100 transition-colors duration-500">
                            {item.text.trim() || (item.role === 'user' ? "Listening..." : "Thinking...")}
                        </p>
                      </div>
                  </div>
                ))
              )}
              <div ref={historyEndRef} className="h-8" />
           </div>
        </div>
      </div>
    </div>
  );
};

export default LiveBrainstorm;
