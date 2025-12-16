import React, { useRef, useState, useEffect } from 'react';
import Editor from 'react-simple-code-editor';
import { Bold, Italic, List, Heading1, Heading2, Quote, Code, Link, Undo, Redo, Type, AlignLeft } from 'lucide-react';

declare const Prism: any;

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ value, onChange }) => {
  const editorRef = useRef<any>(null);
  
  // History Management
  const [history, setHistory] = useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedoAction = useRef(false);

  // Update history when value changes externally (but not from undo/redo)
  useEffect(() => {
    if (isUndoRedoAction.current) {
        isUndoRedoAction.current = false;
        return;
    }
    
    // Simple debounce/check to avoid saving every keystroke immediately could be added here
    // For now, we save significant changes or rely on the parent's update cycle
    if (history[historyIndex] !== value) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(value);
        // Limit history size to 100 steps
        if (newHistory.length > 100) newHistory.shift();
        
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }
  }, [value]);

  const handleUndo = () => {
    if (historyIndex > 0) {
        isUndoRedoAction.current = true;
        const newValue = history[historyIndex - 1];
        setHistoryIndex(historyIndex - 1);
        onChange(newValue);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
        isUndoRedoAction.current = true;
        const newValue = history[historyIndex + 1];
        setHistoryIndex(historyIndex + 1);
        onChange(newValue);
    }
  };

  const updateText = (newText: string) => {
      onChange(newText);
  };

  const insertFormat = (prefix: string, suffix: string = '') => {
    if (!editorRef.current || !editorRef.current._input) return;

    const textarea = editorRef.current._input;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    const newText = before + prefix + selection + suffix + after;
    
    updateText(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        end + prefix.length
      );
    }, 0);
  };

  const insertBlock = (prefix: string) => {
    if (!editorRef.current || !editorRef.current._input) return;

    const textarea = editorRef.current._input;
    const start = textarea.selectionStart;
    const text = textarea.value;

    // Find start of current line
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const before = text.substring(0, lineStart);
    const after = text.substring(lineStart);
    
    // Check if line already has the prefix to toggle it off (basic toggle)
    if (after.startsWith(prefix)) {
        const newText = before + after.substring(prefix.length);
        updateText(newText);
    } else {
        const newText = before + prefix + after;
        updateText(newText);
    }
    
    setTimeout(() => {
        textarea.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Tab') {
          e.preventDefault();
          if (!editorRef.current || !editorRef.current._input) return;
          const textarea = editorRef.current._input;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const text = textarea.value;
          
          // Insert 2 spaces
          const newText = text.substring(0, start) + '  ' + text.substring(end);
          updateText(newText);
          
          setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = start + 2;
          }, 0);
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
      }
  };

  const highlight = (code: string) => {
    if (typeof Prism !== 'undefined' && Prism.languages.markdown) {
      return Prism.highlight(code, Prism.languages.markdown, 'markdown');
    }
    return code; 
  };

  // Stats
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
  const charCount = value.length;

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] relative group">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-[#252526] border-b border-[#333] sticky top-0 z-20 overflow-x-auto no-scrollbar shrink-0">
        <ToolButton icon={Undo} label="Undo (Ctrl+Z)" onClick={handleUndo} disabled={historyIndex <= 0} />
        <ToolButton icon={Redo} label="Redo (Ctrl+Shift+Z)" onClick={handleRedo} disabled={historyIndex >= history.length - 1} />
        <div className="w-px h-4 bg-zinc-700 mx-1" />
        <ToolButton icon={Bold} label="Bold" onClick={() => insertFormat('**', '**')} />
        <ToolButton icon={Italic} label="Italic" onClick={() => insertFormat('*', '*')} />
        <div className="w-px h-4 bg-zinc-700 mx-1" />
        <ToolButton icon={Heading1} label="Heading 1" onClick={() => insertBlock('# ')} />
        <ToolButton icon={Heading2} label="Heading 2" onClick={() => insertBlock('## ')} />
        <div className="w-px h-4 bg-zinc-700 mx-1" />
        <ToolButton icon={List} label="Bulleted List" onClick={() => insertBlock('- ')} />
        <ToolButton icon={Quote} label="Quote" onClick={() => insertBlock('> ')} />
        <div className="w-px h-4 bg-zinc-700 mx-1" />
        <ToolButton icon={Code} label="Code Block" onClick={() => insertFormat('```\n', '\n```')} />
        <ToolButton icon={Link} label="Link" onClick={() => insertFormat('[', '](url)')} />
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-y-auto relative custom-scrollbar prism-editor" onClick={() => editorRef.current?._input?.focus()}>
        <Editor
          ref={editorRef}
          value={value}
          onValueChange={onChange}
          highlight={highlight}
          padding={24}
          onKeyDown={handleKeyDown}
          className="font-mono text-sm leading-relaxed min-h-full"
          style={{
            fontFamily: '"Fira Code", "Fira Mono", monospace',
            fontSize: 14,
            backgroundColor: '#1e1e1e',
            color: '#e4e4e7', // zinc-200 for better contrast
            lineHeight: '1.6', // Improved readability
          }}
          textareaClassName="focus:outline-none"
        />
      </div>
      
      {/* Status Bar */}
      <div className="h-6 bg-[#252526] border-t border-[#333] flex items-center justify-end px-4 gap-4 text-[10px] text-zinc-500 font-mono select-none shrink-0">
          <span className="flex items-center gap-1"><AlignLeft className="w-3 h-3"/> {wordCount} words</span>
          <span className="flex items-center gap-1"><Type className="w-3 h-3"/> {charCount} chars</span>
          <span className="text-zinc-600">Markdown</span>
      </div>
    </div>
  );
};

const ToolButton: React.FC<{ icon: any, label: string, onClick: () => void, disabled?: boolean }> = ({ icon: Icon, label, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`p-1.5 rounded transition-colors ${disabled ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
    title={label}
  >
    <Icon className="w-4 h-4" />
  </button>
);
