
import React, { useState, useEffect } from 'react';
import { X, Search, Folder, FileText, Image as ImageIcon, ChevronRight, UploadCloud, Grid, List, CheckCircle2, HardDrive, Loader2, File, AlertTriangle, RefreshCw, Key, ExternalLink, LogOut, FolderPlus, ArrowRight, CornerDownRight } from 'lucide-react';
import { Attachment } from '../types';
import { STORAGE_KEY, PLAYGROUND_URL } from '../config';

interface DrivePickerProps {
  isOpen: boolean;
  onClose: () => void;
  // Generic file selection
  onSelect?: (files: Attachment[]) => void;
  // Project selection or Folder Selection
  onSelectProject?: (folderId: string, folderName: string) => void;
  // Mode determines behavior
  mode?: 'file' | 'project_select' | 'project_create_loc' | 'folder_select';
  
  isConnected: boolean;
  onConnect: () => void;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  iconLink?: string;
}

interface Breadcrumb {
  id: string;
  name: string;
}

export const DrivePicker: React.FC<DrivePickerProps> = ({ 
  isOpen, onClose, onSelect, onSelectProject, onConnect, mode = 'file' 
}) => {
  // State
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drive Data State
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: 'root', name: 'My Drive' }]);
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  
  // UI State
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isGrid, setIsGrid] = useState(true);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState(''); // Debounced query used for API calls
  const [downloading, setDownloading] = useState(false);

  // --- Initialization ---
  useEffect(() => {
      const initToken = async () => {
          const stored = localStorage.getItem(STORAGE_KEY);

          if (stored) {
              setIsValidating(true);
              try {
                  // Verify token is actually valid by making a lightweight call
                  const fileList = await listFiles(stored, 'root');
                  setAccessToken(stored);
                  setFiles(fileList);
                  onConnect();
              } catch (err) {
                  console.warn("Stored token invalid or expired", err);
                  localStorage.removeItem(STORAGE_KEY);
                  setAccessToken(null);
                  setError("Previous session expired. Please connect again.");
              } finally {
                  setIsValidating(false);
              }
          }
      };
      initToken();
  }, []);

  // --- Debounce Logic ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveQuery(searchQuery);
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --- API Operations ---

  const listFiles = async (token: string, folderId: string, query?: string) => {
    try {
      let q = "trashed = false";
      
      // If in folder_select mode, ONLY show folders
      if (mode === 'folder_select') {
          q += " and mimeType = 'application/vnd.google-apps.folder'";
      }

      if (query && query.trim()) {
        const safeQuery = query.trim().replace(/'/g, "\\'");
        q += ` and name contains '${safeQuery}'`;
      } else {
        q += ` and '${folderId}' in parents`;
      }

      const params = new URLSearchParams({
        q,
        fields: 'files(id, name, mimeType, size, modifiedTime, thumbnailLink, iconLink)',
        orderBy: 'folder,name',
        pageSize: '100'
      });

      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) throw new Error("TOKEN_EXPIRED");
      if (!response.ok) throw new Error(`Drive API Error: ${response.statusText}`);
      
      const data = await response.json();
      return data.files || [];
    } catch (err) {
      throw err;
    }
  };

  const loadFiles = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
        const fileList = await listFiles(accessToken, currentFolderId, activeQuery);
        setFiles(fileList);
    } catch (err: any) {
        if (err.message === 'TOKEN_EXPIRED') {
            handleDisconnect();
            setError("Session expired. Please reconnect.");
        } else {
            console.error("Load files error:", err);
            setError("Failed to load files.");
        }
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && accessToken) {
      loadFiles();
    }
  }, [isOpen, accessToken, currentFolderId, activeQuery, mode]);

  // --- Actions ---

  const handleConnect = async () => {
      if (!manualToken.trim()) return;
      setIsValidating(true);
      setError(null);
      
      // Sanitize token: remove surrounding quotes if user pasted them
      let token = manualToken.trim();
      if (token.startsWith('"') && token.endsWith('"')) {
          token = token.slice(1, -1);
      }
      if (token.startsWith("'") && token.endsWith("'")) {
          token = token.slice(1, -1);
      }

      try {
          const fileList = await listFiles(token, 'root');
          
          // If we reach here, token is valid
          localStorage.setItem(STORAGE_KEY, token); // Persist first
          setAccessToken(token);
          setFiles(fileList);
          onConnect();
          setManualToken('');
      } catch (err: any) {
          console.error(err);
          setError("Invalid Access Token. Please generate a new one via the Playground.");
      } finally {
          setIsValidating(false);
      }
  };

  const handleDisconnect = () => {
      setAccessToken(null);
      setFiles([]);
      setCurrentFolderId('root');
      setBreadcrumbs([{ id: 'root', name: 'My Drive' }]);
      setSearchQuery('');
      setActiveQuery('');
      localStorage.removeItem(STORAGE_KEY);
  };

  const handleFolderClick = (folderId: string, folderName: string) => {
    setSearchQuery('');
    setActiveQuery(''); // Immediate reset for navigation
    setBreadcrumbs(prev => [...prev, { id: folderId, name: folderName }]);
    setCurrentFolderId(folderId);
    setSelectedFileIds(new Set());
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    setSearchQuery('');
    setActiveQuery(''); // Immediate reset for navigation
    setSelectedFileIds(new Set());
  };

  // --- Mode Specific Helpers ---

  const isPlatiniumProject = (name: string) => name.toLowerCase().endsWith('.platinium');

  const handleProjectSelect = (folderId: string, folderName: string) => {
     if (onSelectProject) {
        onSelectProject(folderId, folderName);
        onClose();
     }
  };

  // --- Download Logic (File Mode Only) ---
  const toggleSelection = (id: string, multi: boolean) => {
    const newSet = new Set(multi ? selectedFileIds : []);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedFileIds(newSet);
  };

  const processAndDownload = async () => {
    if (!accessToken || !onSelect) return;
    setDownloading(true);
    const attachments: Attachment[] = [];

    try {
      const selectedFiles = files.filter(f => selectedFileIds.has(f.id) && f.mimeType !== 'application/vnd.google-apps.folder');
      
      for (const file of selectedFiles) {
        let url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        let mime = file.mimeType;
        let type: 'pdf' | 'text' | 'image' = 'text';

        if (file.mimeType.includes('application/vnd.google-apps')) {
           url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=application/pdf`;
           mime = 'application/pdf';
           type = 'pdf';
        } else if (file.mimeType.includes('image')) type = 'image';
        else if (file.mimeType.includes('pdf')) type = 'pdf';

        const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!response.ok) continue;

        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => { resolve((reader.result as string).split(',')[1]); };
            reader.readAsDataURL(blob);
        });

        // Pass the ID so the main app knows it's a Drive file
        attachments.push({ id: file.id, name: file.name, mime, type, data: base64 });
      }
      onSelect(attachments);
      onClose();
    } catch (err) {
      setError("Failed to download selected files.");
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  // RENDER: Auth Screen
  if (!accessToken) {
      return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="w-full max-w-md bg-[#09090b] rounded-xl border border-zinc-800 p-8 flex flex-col relative shadow-2xl">
               <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X className="w-5 h-5"/></button>
               <div className="flex items-center justify-center mb-6">
                   <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700"><Key className="w-6 h-6 text-white"/></div>
               </div>
               <h2 className="text-xl font-bold text-white text-center mb-2">Connect Google Drive</h2>
               <p className="text-zinc-400 text-center text-xs mb-8">Securely connect using an OAuth Access Token.</p>
               {error && (<div className="mb-6 p-3 bg-red-950/30 border border-red-900/50 rounded flex gap-3 items-start"><AlertTriangle className="w-5 h-5 text-red-500 shrink-0"/><p className="text-xs text-red-200">{error}</p></div>)}
               <div className="space-y-6">
                    <div className="p-4 bg-blue-950/10 border border-blue-900/30 rounded-lg space-y-3">
                        <div className="flex justify-between items-center"><h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Step 1: Get Token</h4></div>
                        <a href={PLAYGROUND_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-colors shadow-lg shadow-blue-900/20"><ExternalLink className="w-3.5 h-3.5" /> Open Google Playground</a>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Step 2: Paste Token</label>
                       <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-lg px-3 py-2.5 focus-within:border-zinc-600 transition-colors">
                           <Key className="w-4 h-4 text-zinc-600"/><input value={manualToken} onChange={(e) => setManualToken(e.target.value)} placeholder="Paste token starting with ya29..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white placeholder:text-zinc-700"/>
                       </div>
                   </div>
                   <button onClick={handleConnect} disabled={!manualToken.trim() || isValidating} className="w-full py-3 bg-white hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg uppercase tracking-wider transition-colors flex items-center justify-center gap-2">{isValidating ? <Loader2 className="w-4 h-4 animate-spin"/> : <HardDrive className="w-4 h-4"/>}{isValidating ? 'Verifying...' : 'Connect Drive'}</button>
               </div>
           </div>
        </div>
      );
  }

  // RENDER: File Browser
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl h-[600px] bg-[#09090b] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-zinc-800">
         
         {/* Header */}
         <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-[#09090b]">
             <div className="flex items-center gap-3">
                 <HardDrive className="w-5 h-5 text-green-500"/>
                 <div>
                    <span className="font-bold text-white tracking-tight block">Google Drive</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                       {mode === 'project_select' ? 'Select Project Folder' : 
                        mode === 'project_create_loc' ? 'Choose Location' : 
                        mode === 'folder_select' ? 'Select Destination Folder' :
                        'Import Files'}
                    </span>
                 </div>
             </div>
             
             <div className="flex-1 max-w-md mx-6 relative hidden md:block">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"/>
                 <input 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                    className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-zinc-700 rounded-lg pl-10 pr-8 py-2 text-sm text-white focus:outline-none transition-all placeholder:text-zinc-600" 
                    placeholder="Search..."
                 />
                 {searchQuery && (
                    <button 
                      onClick={() => { setSearchQuery(''); setActiveQuery(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white rounded-full hover:bg-zinc-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                 )}
             </div>

             <div className="flex items-center gap-3">
                 <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                     <button onClick={() => setIsGrid(true)} className={`p-1.5 rounded ${isGrid ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}><Grid className="w-4 h-4"/></button>
                     <button onClick={() => setIsGrid(false)} className={`p-1.5 rounded ${!isGrid ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}><List className="w-4 h-4"/></button>
                 </div>
                 <button onClick={handleDisconnect} className="p-2 hover:bg-red-950/30 rounded-full text-zinc-400 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5"/></button>
                 <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
             </div>
         </div>

         {/* Toolbar / Breadcrumbs */}
         <div className="h-12 border-b border-zinc-800/50 flex items-center px-6 bg-[#0c0c0e] text-sm text-zinc-400 overflow-x-auto">
             {breadcrumbs.map((crumb, i) => (
               <React.Fragment key={crumb.id}>
                 <button onClick={() => handleBreadcrumbClick(i)} className="hover:text-white hover:bg-zinc-800 px-2 py-1 rounded transition-colors whitespace-nowrap font-medium">{crumb.name}</button>
                 {i < breadcrumbs.length - 1 && <ChevronRight className="w-4 h-4 text-zinc-600 mx-1 flex-shrink-0"/>}
               </React.Fragment>
             ))}
             {isLoading && <Loader2 className="w-4 h-4 animate-spin ml-4 text-zinc-600"/>}
         </div>

         {/* File Grid/List */}
         <div className="flex-1 overflow-y-auto p-6 bg-[#09090b]">
            {error ? (
               <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                  <AlertTriangle className="w-8 h-8 text-red-500 opacity-80"/>
                  <p className="text-red-300 text-center px-4 text-sm max-w-xs">{error}</p>
                  <button onClick={loadFiles} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs uppercase font-bold tracking-wider text-white transition-colors">Retry Connection</button>
               </div>
            ) : files.length === 0 && !isLoading ? (
               <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                   <Folder className="w-16 h-16 mb-4 opacity-10"/>
                   <p className="text-sm">{activeQuery ? 'No results found' : 'No files found in this folder'}</p>
               </div>
            ) : (
               <div className={isGrid ? "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4" : "flex flex-col gap-1"}>
                   {files.map(file => {
                      const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                      const isSelected = selectedFileIds.has(file.id);
                      const isPlatinium = isFolder && isPlatiniumProject(file.name);
                      
                      // Disable selection if in project_select mode and NOT a project or folder
                      const isDisabled = (mode === 'project_select' && !isFolder);
                      
                      let Icon = File;
                      let color = "text-zinc-500";
                      
                      if (isPlatinium) { Icon = HardDrive; color = "text-cyan-400"; }
                      else if (isFolder) { Icon = Folder; color = "text-blue-400"; }
                      else if (file.mimeType.includes('image')) { Icon = ImageIcon; color = "text-purple-400"; }
                      else if (file.mimeType.includes('pdf')) { Icon = FileText; color = "text-red-400"; }

                      return (
                        <div 
                          key={file.id}
                          className={`
                            group relative select-none transition-all
                            ${isDisabled ? 'opacity-30' : ''}
                            ${isGrid 
                                ? `flex flex-col p-3 rounded-xl border ${isSelected ? 'bg-blue-900/10 border-blue-500/50' : 'bg-zinc-900/30 border-transparent hover:bg-zinc-900'} ${isPlatinium ? 'shadow-[0_0_15px_rgba(6,182,212,0.1)] border-cyan-900/30' : ''}` 
                                : `flex items-center p-2 rounded-lg border-b border-zinc-800/50 ${isSelected ? 'bg-blue-900/10' : 'hover:bg-zinc-900'}`
                            }
                          `}
                          onClick={(e) => {
                             if (mode === 'file' && !isFolder) toggleSelection(file.id, e.metaKey || e.ctrlKey);
                          }}
                          onDoubleClick={() => {
                             if (isFolder && !isPlatinium) handleFolderClick(file.id, file.name);
                          }}
                        >
                           {/* Grid View Content */}
                           {isGrid ? (
                             <>
                               <div className="h-24 flex items-center justify-center mb-3 bg-black/40 rounded-lg overflow-hidden relative border border-zinc-800/50">
                                  {file.thumbnailLink && !isFolder ? (
                                    <img src={file.thumbnailLink} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt=""/>
                                  ) : (
                                    <Icon className={`w-10 h-10 ${color} opacity-80 group-hover:opacity-100 transition-opacity`}/>
                                  )}
                               </div>
                               <div className="flex flex-col relative z-10">
                                  <span className={`text-xs font-medium truncate w-full ${isPlatinium ? 'text-cyan-200' : 'text-zinc-400'}`}>{file.name}</span>
                               </div>
                             </>
                           ) : (
                             // List View Content
                             <>
                               <Icon className={`w-5 h-5 mr-4 ${color}`}/>
                               <span className={`text-sm flex-1 truncate ${isPlatinium ? 'text-cyan-200' : 'text-zinc-400'}`}>{file.name}</span>
                             </>
                           )}

                           {/* Project Selection Overlay */}
                           {mode === 'project_select' && isPlatinium && (
                               <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl backdrop-blur-[2px]">
                                   <button 
                                      onClick={() => handleProjectSelect(file.id, file.name)}
                                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold uppercase rounded-full shadow-lg"
                                   >
                                      Select Project
                                   </button>
                               </div>
                           )}

                           {/* Navigation Overlay (for standard folders in project/folder mode) */}
                           { (mode === 'project_select' || mode === 'folder_select') && isFolder && !isPlatinium && (
                               <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                                   <button 
                                      onClick={() => handleFolderClick(file.id, file.name)}
                                      className="p-2 bg-zinc-800 text-zinc-300 rounded-full hover:text-white"
                                   >
                                      <Folder className="w-5 h-5"/>
                                   </button>
                               </div>
                           )}
                        </div>
                      );
                   })}
               </div>
            )}
         </div>

         {/* Footer */}
         <div className="h-16 border-t border-zinc-800 flex items-center justify-between px-6 bg-[#09090b]">
            <div className="text-xs text-zinc-500 font-medium">
                {mode === 'file' ? `${selectedFileIds.size} file(s) selected` : 
                 mode === 'project_select' ? 'Select a .platinium folder' : 
                 mode === 'folder_select' ? 'Select Destination Folder' :
                 `Current Location: ${breadcrumbs[breadcrumbs.length-1].name}`}
            </div>
            
            <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-white uppercase tracking-wider transition-colors">Cancel</button>
                
                {mode === 'file' && (
                    <button 
                        onClick={processAndDownload}
                        disabled={selectedFileIds.size === 0 || downloading}
                        className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${selectedFileIds.size > 0 ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-800 text-zinc-600'}`}
                    >
                        {downloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <UploadCloud className="w-4 h-4"/>}
                        {downloading ? 'Downloading...' : 'Import Selected'}
                    </button>
                )}

                {(mode === 'project_create_loc' || mode === 'folder_select') && (
                   <button
                       onClick={() => handleProjectSelect(currentFolderId, breadcrumbs[breadcrumbs.length-1].name)}
                       className="px-6 py-2 bg-white text-black hover:bg-zinc-200 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                   >
                       {mode === 'folder_select' ? 'Save Here' : 'Create Here'} <ArrowRight className="w-4 h-4"/>
                   </button>
                )}
            </div>
         </div>
      </div>
    </div>
  );
};
