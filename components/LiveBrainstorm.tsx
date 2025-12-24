
import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Radio, StopCircle, Activity, Volume2, VolumeX, Sparkles } from 'lucide-react';

interface LiveBrainstormProps {
  status: 'disconnected' | 'connecting' | 'connected';
  isMuted: boolean;
  volume: number;
  onToggleMute: () => void;
  onUpdateVolume: (val: number) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  inputAnalyser: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
}

const LiveBrainstorm: React.FC<LiveBrainstormProps> = ({ 
  status, isMuted, volume, onToggleMute, onUpdateVolume, onConnect, onDisconnect, inputAnalyser, outputAnalyser 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const levelsRef = useRef({ lastInput: 0, lastOutput: 0 });

  useEffect(() => {
    const draw = () => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const { width, height } = canvasRef.current;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) / 3.8;

      ctx.clearRect(0, 0, width, height);

      const getLevel = (analyser: AnalyserNode | null) => {
        if (!analyser) return 0;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        return data.reduce((a, b) => a + b, 0) / data.length;
      };

      const outL = getLevel(outputAnalyser);
      const inL = isMuted ? 0 : getLevel(inputAnalyser);

      levelsRef.current.lastOutput = levelsRef.current.lastOutput * 0.8 + outL * 0.2;
      levelsRef.current.lastInput = levelsRef.current.lastInput * 0.8 + inL * 0.2;

      const drawWave = (analyser: AnalyserNode | null, color: string, level: number, offset: number, complexity: number, opacity: number) => {
        if (!analyser) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.globalAlpha = opacity;
        ctx.lineWidth = 2;
        
        const points = 180;
        const time = performance.now() * 0.001;
        for (let i = 0; i <= points; i++) {
          const angle = (i * Math.PI * 2) / points;
          const freq = data[Math.floor((i % points) * (data.length / points))] / 255;
          const r = baseRadius + offset + (freq * level * 0.8) + Math.sin(angle * complexity + time * 2) * 10;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        if (level > 2) { ctx.fillStyle = color.replace(/[\d.]+\)/, '0.05)'); ctx.fill(); }
        ctx.restore();
      };

      if (status === 'connected') {
        drawWave(outputAnalyser, 'rgba(34, 211, 238, 0.85)', levelsRef.current.lastOutput, 0, 8, 0.8);
        drawWave(inputAnalyser, 'rgba(255, 255, 255, 0.9)', levelsRef.current.lastInput, 40, 32, 0.8);
      } else {
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius + Math.sin(Date.now() * 0.002) * 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [status, inputAnalyser, outputAnalyser, isMuted]);

  return (
    <div className="flex h-full bg-[#050505] text-white p-8 relative overflow-hidden font-sans">
      <div className={`absolute inset-0 transition-all duration-1000 opacity-20 pointer-events-none ${status === 'connected' ? 'bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-950/40 via-black to-black' : ''}`} />

      <div className="flex flex-col w-full h-full items-center justify-center gap-12 z-10 animate-fade-in relative">
        <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.9)]' : 'bg-zinc-800'}`} />
              <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-500">Neuro-Sync Engine</h2>
            </div>
            
            <div className="relative flex items-center justify-center w-[440px] h-[440px] mx-auto group">
               <div className={`absolute inset-0 rounded-full border border-white/5 transition-all duration-[2000ms] ${status === 'connected' ? 'scale-105 opacity-100' : 'scale-90 opacity-20'}`} />
               <canvas ref={canvasRef} width={600} height={600} className="w-[120%] h-[120%] pointer-events-none absolute" />
               <div className={`w-32 h-32 rounded-full flex items-center justify-center bg-black border border-zinc-800 shadow-[0_0_60px_rgba(0,0,0,0.6)] transition-all duration-1000 ${status === 'connected' ? 'opacity-100 scale-100' : 'opacity-40 scale-90'}`}>
                  {status === 'connected' ? (
                    <div className="relative">
                      <Sparkles className="w-12 h-12 text-cyan-400 animate-pulse" />
                      <div className="absolute inset-0 blur-lg bg-cyan-400/20 rounded-full animate-ping" />
                    </div>
                  ) : (
                    <Activity className="w-12 h-12 text-zinc-700" />
                  )}
               </div>
            </div>
        </div>

        <div className="bg-[#0c0c0e]/70 backdrop-blur-3xl p-8 rounded-[3rem] border border-white/[0.04] space-y-8 shadow-2xl w-full max-w-[440px]">
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
                      onChange={(e) => onUpdateVolume(parseFloat(e.target.value))} 
                      className="flex-1 h-1 rounded-full appearance-none cursor-pointer hover:bg-zinc-800 transition-all accent-cyan-400"
                      style={{ background: `linear-gradient(to right, #22d3ee ${volume * 100}%, #18181b ${volume * 100}%)` }}
                   />
                   <Volume2 className={`w-4 h-4 transition-colors ${volume > 0.7 ? 'text-cyan-400' : 'text-zinc-700'}`} />
                </div>
            </div>

            <div className="flex flex-col gap-4">
              {status !== 'connected' ? (
                <button 
                  onClick={onConnect} 
                  disabled={status === 'connecting'} 
                  className="group w-full flex items-center justify-center gap-4 px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-[0.4em] transition-all text-[11px] active:scale-95 disabled:opacity-50 shadow-[0_20px_40px_rgba(255,255,255,0.05)]"
                >
                  <Radio className={`w-4 h-4 ${status === 'connecting' ? 'animate-spin text-zinc-400' : 'animate-pulse text-zinc-900'}`} />
                  {status === 'connecting' ? 'Calibrating' : 'Sync Engine'}
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button 
                      onClick={onToggleMute} 
                      className={`flex items-center justify-center gap-3 py-4 rounded-xl font-black uppercase tracking-widest transition-all border text-[10px] active:scale-95 ${isMuted ? 'bg-red-950/20 border-red-900/40 text-red-500' : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white'}`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {isMuted ? 'Muted' : 'Live'}
                  </button>
                  <button 
                      onClick={onDisconnect} 
                      className="flex items-center justify-center gap-3 py-4 bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white rounded-xl font-black uppercase tracking-widest transition-all text-[10px] active:scale-95 hover:bg-red-600/20 hover:border-red-500/40"
                  >
                    <StopCircle className="w-4 h-4" /> Stop
                  </button>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default LiveBrainstorm;
