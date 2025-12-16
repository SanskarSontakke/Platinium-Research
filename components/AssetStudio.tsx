
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

  // Click outside to close menu
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
        await loadAssets(); // Refresh list
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
      // Hack to get larger image from Drive thumbnail link
      return link.replace(/=s\d+/, '=s1200'); 
  };

  return (
    <div className="flex flex-col h-full bg-[#18181b] p-6 gap-6 overflow-hidden relative">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-4">
        <div>
           <h2 className="text-xl font-bold text-white flex items-center gap-2">
             <ImageIcon className="w-5 h-5 text-purple-400" /> Assets
           </h2>
           <p className="text-zinc-500 text-xs mt-1">Project storage for visual assets.</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
            <button 
                onClick={loadAssets} 
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                title="Refresh"
            >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
               onClick={() => setShowImportPicker(true)}
               className="flex-1 md:flex-none px-4 py-2 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-white text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-2 transition-all"
            >
                <HardDrive className="w-3.5 h-3.5" /> Import
            </button>
            <button 
               onClick={() => fileInputRef.current?.click()}
               className="flex-1 md:flex-none px-4 py-2 bg-white text-black hover:bg-zinc-200 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-2 transition-all"
            >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5" />}
                Upload
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 relative custom-scrollbar">
          {loading && assets.length === 0 ? (
              // Loading Skeleton
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                  {[1,2,3,4,5,6].map(i => (
                      <div key={i} className="aspect-square bg-zinc-900/50 rounded-xl border border-zinc-800 animate-pulse flex flex-col overflow-hidden">
                          <div className="flex-1 bg-zinc-800/30"></div>
                          <div className="h-10 border-t border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
                              <div className="h-2 bg-zinc-800 rounded w-2/3"></div>
                          </div>
                      </div>
                  ))}
              </div>
          ) : assets.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-50">
                 <ImageIcon className="w-16 h-16 mb-4" />
                 <p className="text-sm">No assets yet.</p>
             </div>
          ) : (
             <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                 {assets.map(asset => (
                     <div key={asset.id} className="group relative bg-black border border-zinc-800 rounded-xl overflow-visible aspect-square flex flex-col hover:border-zinc-600 transition-colors">
                         {/* Thumbnail Area - Click to Preview */}
                         <div 
                            className="flex-1 relative bg-zinc-900/50 flex items-center justify-center overflow-hidden rounded-t-xl cursor-pointer"
                            onClick={() => setPreviewAsset(asset)}
                         >
                             {asset.thumbnailLink ? (
                                 <img src={asset.thumbnailLink} alt={asset.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                             ) : (
                                 <FileText className="w-10 h-10 text-zinc-600" />
                             )}
                         </div>

                         {/* 3-Dot Menu Button */}
                         <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setMenuOpenId(menuOpenId === asset.id ? null : asset.id); 
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                         >
                            <MoreVertical className="w-4 h-4" />
                         </button>

                         {/* Dropdown Menu */}
                         {menuOpenId === asset.id && (
                             <div 
                                ref={menuRef}
                                className="absolute top-8 right-2 w-40 bg-[#18181b] border border-zinc-700 rounded-lg shadow-2xl z-20 flex flex-col py-1 animate-in zoom-in-95 duration-100"
                                onClick={(e) => e.stopPropagation()}
                             >
                                 <button 
                                     onClick={() => { handleAddToChat(asset); setMenuOpenId(null); }}
                                     className="px-3 py-2 text-left text-[10px] font-bold uppercase text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                                 >
                                     <MessageSquarePlus className="w-3 h-3"/> Add to Chat
                                 </button>
                                 <button 
                                     onClick={() => { setAssetToExport(asset); setShowExportPicker(true); setMenuOpenId(null); }}
                                     className="px-3 py-2 text-left text-[10px] font-bold uppercase text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                                 >
                                     <Copy className="w-3 h-3"/> Save Copy
                                 </button>
                                 <button 
                                     onClick={() => { handleDownload(asset); setMenuOpenId(null); }}
                                     className="px-3 py-2 text-left text-[10px] font-bold uppercase text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                                 >
                                     <Download className="w-3 h-3"/> Download
                                 </button>
                             </div>
                         )}
                         
                         {/* Name Footer */}
                         <div className="p-3 bg-[#18181b] border-t border-zinc-800 rounded-b-xl">
                             <p className="text-[10px] text-zinc-300 font-medium truncate" title={asset.name}>{asset.name}</p>
                         </div>
                     </div>
                 ))}
             </div>
          )}
      </div>

      {/* Preview Overlay */}
      {previewAsset && (
          <div 
             className="absolute inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200"
             onClick={() => setPreviewAsset(null)}
          >
              <div className="relative w-full h-full flex items-center justify-center p-8 md:p-12" onClick={(e) => e.stopPropagation()}>
                  <button 
                      onClick={() => setPreviewAsset(null)}
                      className="absolute top-4 right-4 p-2 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 transition-colors shadow-lg z-50"
                  >
                      <X className="w-5 h-5" />
                  </button>
                  
                  {previewAsset.mimeType.includes('image') ? (
                      <img 
                          src={getHighResUrl(previewAsset.thumbnailLink)} 
                          alt={previewAsset.name}
                          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-zinc-800" 
                      />
                  ) : (
                      <div className="flex flex-col items-center justify-center gap-6 p-10 bg-zinc-900/80 rounded-2xl border border-zinc-800 max-w-lg w-full shadow-2xl">
                          {previewAsset.mimeType.includes('pdf') ? (
                              <div className="p-6 bg-red-500/10 rounded-3xl border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                                  <FileText className="w-24 h-24 text-red-500" /> 
                              </div>
                          ) : (
                              <div className="p-6 bg-blue-500/10 rounded-3xl border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                                  <FileText className="w-24 h-24 text-blue-500" />
                              </div>
                          )}
                          
                          <div className="text-center space-y-2 w-full">
                              <h3 className="text-xl font-bold text-white truncate px-2" title={previewAsset.name}>{previewAsset.name}</h3>
                              <p className="text-zinc-500 text-xs font-mono bg-black/50 px-2 py-1 rounded inline-block">{previewAsset.mimeType}</p>
                          </div>

                          <div className="h-px w-full bg-zinc-800/50" />

                          <div className="flex flex-col gap-2 w-full">
                              <button 
                                 onClick={() => handleDownload(previewAsset)}
                                 className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white hover:bg-zinc-200 text-black font-bold uppercase text-xs tracking-wider rounded-xl transition-all shadow-lg hover:scale-[1.02] active:scale-95"
                              >
                                 <ExternalLink className="w-4 h-4"/> Open Original File
                              </button>
                              <p className="text-[10px] text-zinc-600 text-center">Opening in Google Drive Viewer</p>
                          </div>
                      </div>
                  )}
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
