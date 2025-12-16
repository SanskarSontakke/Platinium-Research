import React, { useEffect, useRef, useState } from 'react';
import { getLiveClient } from '../services/geminiService';
import { LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Radio, StopCircle } from 'lucide-react';

const LiveBrainstorm: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputNodeRef = useRef<ScriptProcessorNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  
  const createBlob = (data: Float32Array): any => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return {
      data: base64,
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const decodeAudioData = async (
    base64: string,
    ctx: AudioContext,
  ): Promise<AudioBuffer> => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const dataInt16 = new Int16Array(bytes.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  const connectToLive = async () => {
    try {
      setStatus('connecting');

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      outputNodeRef.current = outputAudioContextRef.current.createGain();
      outputNodeRef.current.connect(outputAudioContextRef.current.destination);

      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      const liveClient = getLiveClient();

      const sessionPromise = liveClient.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Live Session Opened');
            setStatus('connected');
            setIsConnected(true);

            if (!inputAudioContextRef.current || !streamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            inputNodeRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              if (isMuted) return; 
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              
              sessionPromise.then((session) => {
                  sessionRef.current = session;
                  session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && outputAudioContextRef.current && outputNodeRef.current) {
                const ctx = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                const audioBuffer = await decodeAudioData(base64Audio, ctx);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNodeRef.current);
                
                source.addEventListener('ended', () => {
                   sourcesRef.current.delete(source);
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
             }

             if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(src => src.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
             }
          },
          onclose: () => {
            console.log('Live Session Closed');
            setStatus('disconnected');
            setIsConnected(false);
          },
          onerror: (err) => {
            console.error('Live Session Error', err);
            setStatus('disconnected');
            setIsConnected(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          systemInstruction: "You are Platinium, a sophisticated research colleague. You help brainstorm ideas for academic papers, critique arguments, and suggest new angles of inquiry. Keep responses concise and conversational."
        }
      });
      
    } catch (err) {
      console.error("Failed to connect", err);
      setStatus('disconnected');
    }
  };

  const disconnectLive = () => {
    if (sessionRef.current) {
       try {
          (sessionRef.current as any).close?.();
       } catch (e) { console.warn("Could not close session explicitly", e); }
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (inputNodeRef.current) {
      inputNodeRef.current.disconnect();
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
    }
    
    setStatus('disconnected');
    setIsConnected(false);
    sessionRef.current = null;
  };

  useEffect(() => {
    return () => {
      disconnectLive();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-black text-white p-8">
      <div className="max-w-xl w-full text-center space-y-10">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold uppercase tracking-widest text-white">Live Brainstorming</h2>
          <p className="text-zinc-500 text-sm">Real-time voice channel enabled.</p>
        </div>

        <div className={`relative flex items-center justify-center w-48 h-48 mx-auto rounded-full border-2 transition-all duration-500 ${status === 'connected' ? 'border-white shadow-[0_0_40px_rgba(255,255,255,0.2)]' : 'border-zinc-800'}`}>
          {status === 'connecting' && (
             <div className="absolute inset-0 rounded-full border-t-2 border-white animate-spin"></div>
          )}
          {status === 'connected' ? (
             <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center animate-pulse">
               <Radio className="w-12 h-12 text-black" />
             </div>
          ) : (
             <div className="w-32 h-32 bg-zinc-900 rounded-full flex items-center justify-center">
               <MicOff className="w-12 h-12 text-zinc-600" />
             </div>
          )}
        </div>

        <div className="flex justify-center gap-4">
          {status === 'disconnected' ? (
            <button
              onClick={connectToLive}
              className="flex items-center gap-2 px-8 py-3 bg-white hover:bg-zinc-200 text-black rounded font-bold uppercase tracking-wider transition-colors text-sm"
            >
              <Mic className="w-4 h-4" />
              Start Session
            </button>
          ) : (
            <>
               <button
                onClick={() => setIsMuted(!isMuted)}
                className={`flex items-center gap-2 px-6 py-3 rounded font-bold uppercase tracking-wider transition-colors border text-sm ${isMuted ? 'bg-zinc-900 border-zinc-700 text-red-500' : 'bg-black border-zinc-800 hover:bg-zinc-900 text-white'}`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isMuted ? 'Muted' : 'Mute'}
              </button>
              <button
                onClick={disconnectLive}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded font-bold uppercase tracking-wider transition-colors text-sm"
              >
                <StopCircle className="w-4 h-4" />
                End
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveBrainstorm;