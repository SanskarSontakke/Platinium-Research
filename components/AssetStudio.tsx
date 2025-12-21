
import React, { useState, useEffect, useRef } from 'react';
import { DriveService } from '../services/driveService';
import { Upload, HardDrive, Loader2, Image as ImageIcon, MessageSquarePlus, RefreshCw, FileText, Download, MoreVertical, Copy, X, ExternalLink } from 'lucide-react';
import { DrivePicker } from './DrivePicker';
import { Attachment } from '../types';

interface AssetsViewProps {
  assetsFolderId: string;
  onAddToChat?: (attachment: Attachment) => void;
  onAuthError?: () => void;
}

interface AssetFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webContentLink?: string; // Download link
}

const AssetStudio: React.FC<AssetsViewProps> = ({ assetsFolderId, onAddToChat, onAuthError }) => {
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Pickers
  const [showImportPicker, setShowImportPicker] = useState(false);
  const [showExportPicker, setShowExportPicker] = useState(false);
  const [assetToExport, setAssetToExport] = useState<AssetFile | null>(null);
  
  // Preview & Menu State
  const [previewAsset, setPreviewAsset] = useState<AssetFile | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadAssets = async () => {
    if (!assetsFolderId) return;
    setLoading(true);
    try {
      const files = await DriveService.listAssets(assetsFolderId);
      setAssets(files);
    } catch (e: any) {
      console.error("Failed to load assets", e);
      if (e.message === 'TOKEN_EXPIRED' && onAuthError) {
          onAuthError();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [assetsFolderId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !assetsFolderId) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        
        await DriveService.saveAsset(assetsFolderId, file.name, base64Data, file.type);
        await loadAssets();
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      console.error("Upload failed", e);
      if (e.message === 'TOKEN_EXPIRED' && onAuthError) {
          onAuthError();
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDriveImport = async (files: Attachment[]) => {
      if (!assetsFolderId) return;
      setUploading(true);
      try {
          for (const file of files) {
              if (file.id && !file.id.startsWith('temp_')) {
                  await DriveService.copyFile(file.id, assetsFolderId);
              } else {
                  await DriveService.saveAsset(assetsFolderId, file.name, file.data, file.mime);
              }
          }
          await loadAssets();
      } catch (e: any) {
          console.error("Import failed", e);
          if (e.message === 'TOKEN_EXPIRED' && onAuthError) {
              onAuthError();
          }
      } finally {
          setUploading(false);
      }
  };

  const handleSaveToDrive = async (targetFolderId: string) => {
      if (!assetToExport) return;
      setUploading(true);
      try {
          await DriveService.copyFile(assetToExport.id, targetFolderId);
          alert(`Saved copy of ${assetToExport.name} to Drive.`);
      } catch (e: any) {
          console.error("Failed to save to Drive", e);
          if (e.message === 'TOKEN_EXPIRED' && onAuthError) {
              onAuthError();
          } else {
              alert("Failed to save to Drive.");
          }
      } finally {
          setUploading(false);
          setAssetToExport(null);
      }
  };

  const handleAddToChat = async (asset: AssetFile) => {
      if (!onAddToChat) return;
      try {
         const base64 = await DriveService.getAsset(asset.id);
         let type: 'image' | 'pdf' | 'text' = 'text';
         if (asset.mimeType.includes('image')) type = 'image';
         else if (asset.mimeType.includes('pdf')) type = 'pdf';

         onAddToChat({
             id: asset.id,
             name: asset.name,
             mime: asset.mimeType,
             type: type,
             data: base64
         });
      } catch (e: any) {
          console.error("Failed to fetch asset content", e);
          if (e.message === 'TOKEN_EXPIRED' && onAuthError) {
              onAuthError();
          }
      }
  };

  const handleDownload = (asset: AssetFile) => {
      if (asset.webContentLink) {
          window.open(asset.webContentLink, '_blank');
      }
  };

  const getHighResUrl = (link?: string) => {
      if (!link) return '';
      return link.replace(/=s\d+/, '=s1200'); 
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] p-6 gap-6 overflow-hidden relative animate-fade-in">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800/50 pb-4">
        <div>
           <h2 className="text-xl font-bold text-white flex items-center gap-2">
             <ImageIcon className="w-5 h-5 text-purple-400" /> Assets
           </h2>
           <p className="text-zinc-500 text-xs mt-1">Project storage for visual assets.</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
            <button 
                onClick={loadAssets} 
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-gentle"
                title="Refresh"
            >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
               onClick={() => setShowImportPicker(true)}
               className="flex-1 md:flex-none px-4 py-2 bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-2 transition-gentle active:scale-95 shadow-lg"
            >
                <HardDrive className="w-3.5 h-3.5" /> Import
            </button>
            <button 
               onClick={() => fileInputRef.current?.click()}
               className="flex-1 md:flex-none px-4 py-2 bg-white text-black hover:bg-zinc-100 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-2 transition-gentle active:scale-95 shadow-lg"
            >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5" />}
                Upload
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 relative custom-scrollbar">
          {loading && assets.length === 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5">
                  {[1,2,3,4,5,6,7,8].map(i => (
                      <div key={i} className="aspect-square bg-zinc-900/40 rounded-xl border border-zinc-800 animate-pulse overflow-hidden">
                          <div className="flex-1 bg-zinc-800/20 h-full"></div>
                      </div>
                  ))}
              </div>
          ) : assets.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50 animate-scale-in">
                 <ImageIcon className="w-20 h-20 mb-4 stroke-1" />
                 <p className="text-sm tracking-widest uppercase font-bold">Workspace Empty</p>
             </div>
          ) : (
             <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5">
                 {assets.map((asset, i) => (
                     <div 
                        key={asset.id} 
                        className="group relative bg-[#0d0d0f] border border-zinc-800/50 rounded-xl overflow-visible aspect-square flex flex-col hover:border-zinc-600/80 hover:shadow-2xl transition-all duration-300 animate-fade-in-up"
                        style={{ animationDelay: `${i * 0.05}s` }}
                     >
                         <div 
                            className="flex-1 relative bg-zinc-950/40 flex items-center justify-center overflow-hidden rounded-t-xl cursor-pointer group-hover:bg-zinc-950/20 transition-colors"
                            onClick={() => setPreviewAsset(asset)}
                         >
                             {asset.thumbnailLink ? (
                                 <img src={asset.thumbnailLink} alt={asset.name} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 ease-out" />
                             ) : (
                                 <FileText className="w-12 h-12 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                             )}
                             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/80 bg-black/60 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">Quick Preview</span>
                             </div>
                         </div>

                         <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setMenuOpenId(menuOpenId === asset.id ? null : asset.id); 
                            }}
                            className={`absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black text-white rounded-full transition-all z-10 ${menuOpenId === asset.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                         >
                            <MoreVertical className="w-4 h-4" />
                         </button>

                         {menuOpenId === asset.id && (
                             <div 
                                ref={menuRef}
                                className="absolute top-9 right-2 w-44 glass border border-zinc-700/50 rounded-lg shadow-2xl z-20 flex flex-col py-1.5 animate-scale-in origin-top-right"
                                onClick={(e) => e.stopPropagation()}
                             >
                                 <button 
                                     onClick={() => { handleAddToChat(asset); setMenuOpenId(null); }}
                                     className="px-4 py-2.5 text-left text-[10px] font-bold uppercase text-zinc-400 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-colors"
                                 >
                                     <MessageSquarePlus className="w-4 h-4 text-cyan-400"/> Add to Chat
                                 </button>
                                 <button 
                                     onClick={() => { setAssetToExport(asset); setShowExportPicker(true); setMenuOpenId(null); }}
                                     className="px-4 py-2.5 text-left text-[10px] font-bold uppercase text-zinc-400 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-colors"
                                 >
                                     <Copy className="w-4 h-4 text-purple-400"/> Save Copy
                                 </button>
                                 <button 
                                     onClick={() => { handleDownload(asset); setMenuOpenId(null); }}
                                     className="px-4 py-2.5 text-left text-[10px] font-bold uppercase text-zinc-400 hover:bg-white/5 hover:text-white flex items-center gap-2.5 transition-colors"
                                 >
                                     <Download className="w-4 h-4 text-emerald-400"/> Download
                                 </button>
                             </div>
                         )}
                         
                         <div className="p-3 bg-[#121214] border-t border-zinc-800/50 rounded-b-xl shrink-0">
                             <p className="text-[11px] text-zinc-400 font-medium truncate group-hover:text-zinc-200 transition-colors" title={asset.name}>{asset.name}</p>
                             <p className="text-[9px] text-zinc-600 font-mono mt-0.5 truncate uppercase">{asset.mimeType.split('/')[1]}</p>
                         </div>
                     </div>
                 ))}
             </div>
          )}
      </div>

      {previewAsset && (
          <div 
             className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-12 animate-fade-in"
             onClick={() => setPreviewAsset(null)}
          >
              <div className="relative w-full h-full flex flex-col items-center justify-center animate-scale-in" onClick={(e) => e.stopPropagation()}>
                  <button 
                      onClick={() => setPreviewAsset(null)}
                      className="absolute top-0 right-0 p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full transition-all shadow-xl z-50 hover:rotate-90"
                  >
                      <X className="w-6 h-6" />
                  </button>
                  
                  <div className="max-w-6xl w-full h-full flex items-center justify-center">
                    {previewAsset.mimeType.includes('image') ? (
                        <img 
                            src={getHighResUrl(previewAsset.thumbnailLink)} 
                            alt={previewAsset.name}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/5" 
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-8 p-12 glass border border-white/5 rounded-3xl max-w-xl w-full shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                            {previewAsset.mimeType.includes('pdf') ? (
                                <div className="p-8 bg-red-500/10 rounded-full border border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.1)]">
                                    <FileText className="w-28 h-28 text-red-500/80" /> 
                                </div>
                            ) : (
                                <div className="p-8 bg-blue-500/10 rounded-full border border-blue-500/20 shadow-[0_0_40px_rgba(59,130,246,0.1)]">
                                    <FileText className="w-28 h-28 text-blue-500/80" />
                                </div>
                            )}
                            
                            <div className="text-center space-y-3 w-full">
                                <h3 className="text-2xl font-bold text-white truncate px-2" title={previewAsset.name}>{previewAsset.name}</h3>
                                <div className="flex items-center justify-center gap-2">
                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 py-1 bg-black/40 rounded-full border border-zinc-800">{previewAsset.mimeType}</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 w-full">
                                <button 
                                    onClick={() => handleDownload(previewAsset)}
                                    className="flex items-center justify-center gap-3 px-8 py-4 bg-white hover:bg-zinc-200 text-black font-bold uppercase text-sm tracking-widest rounded-xl transition-all shadow-2xl active:scale-95"
                                >
                                    <ExternalLink className="w-5 h-5"/> Open in Drive
                                </button>
                                <button 
                                    onClick={() => handleAddToChat(previewAsset)}
                                    className="flex items-center justify-center gap-3 px-8 py-4 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold uppercase text-sm tracking-widest rounded-xl transition-all active:scale-95"
                                >
                                    <MessageSquarePlus className="w-5 h-5"/> Send to Chat
                                </button>
                            </div>
                        </div>
                    )}
                  </div>
              </div>
          </div>
      )}

      <DrivePicker 
          isOpen={showImportPicker}
          onClose={() => setShowImportPicker(false)}
          onSelect={handleDriveImport}
          isConnected={true} 
          onConnect={() => {}}
      />

      <DrivePicker 
          isOpen={showExportPicker}
          onClose={() => setShowExportPicker(false)}
          mode="folder_select"
          onSelectProject={(folderId) => handleSaveToDrive(folderId)}
          isConnected={true} 
          onConnect={() => {}}
      />
    </div>
  );
};

export default AssetStudio;
