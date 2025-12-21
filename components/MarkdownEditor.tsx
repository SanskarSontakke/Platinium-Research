
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Editor from 'react-simple-code-editor';
import { Bold, Italic, List, Heading1, Heading2, Quote, Code, Undo, Redo, Eye, LayoutPanelLeft, FileEdit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

declare const Prism: any;

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const MAX_HISTORY = 200;
const TYPING_DEBOUNCE = 700; // slightly longer debounce for more natural typing bursts

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ value, onChange }) => {
  const editorRef = useRef<any>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  
  // History State
  const [history, setHistory] = useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Refs for tracking internal state without re-renders
  const isUndoRedoAction = useRef(false);
  const isUserTyping = useRef(false);
  const lastSavedValue = useRef(value);
  const typingTimer = useRef<number | null>(null);

  /**
   * Pushes a new state onto the history stack.
   */
  const recordState = useCallback((newValue: string) => {
    if (newValue === lastSavedValue.current) return;
    
    setHistory(prev => {
      // If we are in the middle of the history (after undo), clear the "future"
      const baseHistory = prev.slice(0, historyIndex + 1);
      const updated = [...baseHistory, newValue];
      
      // Enforce max history limit
      if (updated.length > MAX_HISTORY) {
        return updated.slice(updated.length - MAX_HISTORY);
      }
      return updated;
    });
    
    // Use functional state update to ensure index is correct relative to history length
    setHistoryIndex(prev => {
      const nextIndex = historyIndex + 1;
      return nextIndex >= MAX_HISTORY ? MAX_HISTORY - 1 : nextIndex;
    });

    lastSavedValue.current = newValue;
  }, [historyIndex]);

  // Synchronize external changes (from AI tool or direct prop updates)
  useEffect(() => {
    // If this update is an echo of an undo/redo we just performed, ignore it
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      lastSavedValue.current = value;
      return;
    }

    // If this update is an echo of our own typing, just update the ref and ignore
    if (isUserTyping.current) {
      lastSavedValue.current = value;
      return;
    }

    // If the value changed and it wasn't us (e.g. AI Agent edited the draft), record immediately
    if (value !== lastSavedValue.current) {
      recordState(value);
    }
  }, [value, recordState]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      isUndoRedoAction.current = true;
      const newValue = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      lastSavedValue.current = newValue;
      onChange(newValue);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true;
      const newValue = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      lastSavedValue.current = newValue;
      onChange(newValue);
    }
  };

  /**
   * Inserts markdown formatting (bold, italic, etc.) around selection.
   * Formatting is considered a "distinct action" and saved immediately.
   */
  const insertFormat = (prefix: string, suffix: string = '') => {
    const textarea = editorRef.current?._input;
    if (!textarea) return;

    textarea.focus();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    const newText = before + prefix + selection + suffix + after;
    
    isUserTyping.current = false; // Mark this as a non-typing action to bypass debounce
    recordState(newText);
    onChange(newText);

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 10);
  };

  /**
   * Handles block-level formatting (headers, lists).
   * Also saved immediately as a distinct action.
   */
  const insertBlock = (prefix: string) => {
    const textarea = editorRef.current?._input;
    if (!textarea) return;

    textarea.focus();
    const start = textarea.selectionStart;
    const text = textarea.value;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    
    const before = text.substring(0, lineStart);
    const lineContent = text.substring(lineStart);
    
    let newText;
    if (lineContent.startsWith(prefix)) {
        newText = before + lineContent.substring(prefix.length);
    } else {
        newText = before + prefix + lineContent;
    }
    
    isUserTyping.current = false;
    recordState(newText);
    onChange(newText);
    setTimeout(() => textarea.focus(), 10);
  };

  /**
   * Handles raw typing events. 
   * Groups continuous typing into bursts using a debounce timer.
   */
  const handleValueChange = (newVal: string) => {
    isUserTyping.current = true;
    onChange(newVal);
    
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    
    typingTimer.current = window.setTimeout(() => {
        recordState(newVal);
        isUserTyping.current = false;
    }, TYPING_DEBOUNCE);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (viewMode === 'preview') return;
      
      // Standard shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo(); else handleUndo();
          return;
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
          e.preventDefault();
          handleRedo();
          return;
      }

      if (e.key === 'Tab') {
          e.preventDefault();
          const textarea = (e.target as HTMLTextAreaElement);
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const text = textarea.value;
          const newText = text.substring(0, start) + '  ' + text.substring(end);
          
          handleValueChange(newText);
          
          setTimeout(() => { 
            textarea.selectionStart = textarea.selectionEnd = start + 2; 
          }, 10);
      }
  };

  const highlight = (code: string) => {
    if (typeof Prism !== 'undefined' && Prism.languages.markdown) {
      return Prism.highlight(code, Prism.languages.markdown, 'markdown');
    }
    return code; 
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f] relative overflow-hidden font-sans">
      <div className="flex items-center gap-1.5 p-2 bg-[#121214] border-b border-zinc-800 shrink-0 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-1 px-2 border-r border-zinc-800">
            <ToolButton icon={Undo} label="Undo (Ctrl+Z)" onClick={handleUndo} disabled={historyIndex <= 0} />
            <ToolButton icon={Redo} label="Redo (Ctrl+Y)" onClick={handleRedo} disabled={historyIndex >= history.length - 1} />
        </div>
        
        <div className="flex items-center gap-1 px-2 border-r border-zinc-800">
            <ToolButton icon={Bold} label="Bold" onClick={() => insertFormat('**', '**')} />
            <ToolButton icon={Italic} label="Italic" onClick={() => insertFormat('*', '*')} />
            <ToolButton icon={Code} label="Code Block" onClick={() => insertFormat('```\n', '\n```')} />
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-zinc-800">
            <ToolButton icon={Heading1} label="Heading 1" onClick={() => insertBlock('# ')} />
            <ToolButton icon={Heading2} label="Heading 2" onClick={() => insertBlock('## ')} />
            <ToolButton icon={List} label="Bulleted List" onClick={() => insertBlock('- ')} />
            <ToolButton icon={Quote} label="Blockquote" onClick={() => insertBlock('> ')} />
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center bg-black/40 rounded-xl p-1 border border-zinc-800">
            <button 
                onClick={() => setViewMode('edit')} 
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'edit' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <FileEdit className="w-3.5 h-3.5 mb-0.5 inline-block mr-1.5" /> Edit
            </button>
            <button 
                onClick={() => setViewMode('split')} 
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'split' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <LayoutPanelLeft className="w-3.5 h-3.5 mb-0.5 inline-block mr-1.5" /> Split
            </button>
            <button 
                onClick={() => setViewMode('preview')} 
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'preview' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <Eye className="w-3.5 h-3.5 mb-0.5 inline-block mr-1.5" /> Preview
            </button>
        </div>
      </div>

      <div className={`flex-1 flex overflow-hidden bg-[#0d0d0f]`}>
        {(viewMode === 'edit' || viewMode === 'split') && (
            <div className={`h-full overflow-y-auto custom-scrollbar prism-editor ${viewMode === 'split' ? 'w-1/2 border-r border-zinc-800' : 'w-full max-w-5xl mx-auto px-4'}`}>
                <Editor
                    ref={editorRef}
                    value={value}
                    onValueChange={handleValueChange}
                    highlight={highlight}
                    padding={32}
                    onKeyDown={handleKeyDown}
                    className="font-mono text-sm leading-relaxed min-h-full selection:bg-cyan-500/20"
                    style={{
                        fontFamily: '"Fira Code", monospace',
                        fontSize: 14,
                        backgroundColor: 'transparent',
                        color: '#e4e4e7',
                        lineHeight: '1.7',
                    }}
                    textareaClassName="focus:outline-none"
                />
            </div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={`h-full overflow-y-auto custom-scrollbar p-16 bg-black/20 ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
                <div className="prose prose-invert prose-sm mx-auto animate-fade-in max-w-4xl">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{value || "*Start writing...*"}</ReactMarkdown>
                </div>
            </div>
        )}
      </div>
      <div className="h-8 bg-[#09090b] border-t border-zinc-800 flex items-center justify-between px-6 text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em] select-none shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.3)]">
          <div className="flex gap-6">
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-zinc-800" /> {value.trim().split(/\s+/).filter(Boolean).length} Words</span>
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-zinc-800" /> {value.length} Characters</span>
          </div>
          <div className="flex items-center gap-3">
              <span className="text-[9px] opacity-40 uppercase">History: {historyIndex + 1}/{history.length}</span>
              <div className="w-px h-3 bg-zinc-800" />
              <span>Draft Workspace</span>
          </div>
      </div>
    </div>
  );
};

const ToolButton: React.FC<{ icon: any, label: string, onClick: () => void, disabled?: boolean }> = ({ icon: Icon, label, onClick, disabled }) => (
  <button 
    onClick={onClick} 
    disabled={disabled} 
    className={`p-2 rounded-xl transition-all active:scale-90 flex items-center justify-center ${disabled ? 'text-zinc-800 cursor-not-allowed opacity-20' : 'text-zinc-500 hover:text-white hover:bg-zinc-800 hover:shadow-lg'}`} 
    title={label}
  >
    <Icon className="w-4 h-4" />
  </button>
);
