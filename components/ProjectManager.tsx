
import React, { useState } from 'react';
import { HardDrive, Plus, Loader2, FolderOpen, ArrowRight } from 'lucide-react';
import { DrivePicker } from './DrivePicker';
import { DriveService } from '../services/driveService';
import { ProjectData } from '../types';
import { Logo } from './Logo';

interface ProjectManagerProps {
  onProjectLoaded: (project: ProjectData) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ onProjectLoaded }) => {
  const [activeView, setActiveView] = useState<'menu' | 'create'>('menu');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'project_select' | 'project_create_loc'>('project_select');
  const [isConnected, setIsConnected] = useState(false);
  
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState('');

  const handleOpenProject = (folderId: string) => {
    setStatus('Loading project...');
    setIsCreating(true); // Re-use loading state
    DriveService.loadProject(folderId)
      .then(project => {
        onProjectLoaded(project);
      })
      .catch(err => {
        console.error(err);
        setStatus(`Error: ${err.message}`);
        setIsCreating(false);
      });
  };

  const handleCreateProject = (parentId: string) => {
    if (!newProjectName) return;
    setStatus('Creating project structure...');
    setIsCreating(true);
    
    DriveService.createProject(newProjectName, parentId)
      .then(project => {
        onProjectLoaded(project);
      })
      .catch(err => {
        console.error(err);
        setStatus(`Creation Failed: ${err.message}`);
        setIsCreating(false);
      });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black relative overflow-hidden">
       {/* Background Aesthetics */}
       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black opacity-50"/>
       <div className="absolute top-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-900 to-transparent opacity-30"/>
       <div className="absolute bottom-0 w-full h-px bg-gradient-to-r from-transparent via-purple-900 to-transparent opacity-30"/>

       <div className="z-10 flex flex-col items-center max-w-md w-full p-8">
           {/* Logo */}
           <div className="mb-12 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
               <div className="w-24 h-24 bg-black border border-zinc-800 rounded-3xl flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.03)] mb-6 relative group">
                   <div className="absolute inset-0 bg-cyan-500/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"/>
                   <Logo className="w-14 h-14 relative z-10" />
               </div>
               <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Platinium Research</h1>
               <p className="text-zinc-500 text-sm tracking-widest uppercase">System Ready</p>
           </div>

           {/* Loading State */}
           {isCreating ? (
               <div className="flex flex-col items-center gap-4 animate-in fade-in">
                   <Loader2 className="w-8 h-8 text-cyan-500 animate-spin"/>
                   <p className="text-zinc-400 text-xs uppercase tracking-widest">{status}</p>
               </div>
           ) : activeView === 'menu' ? (
               // MENU VIEW
               <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                   <button 
                       onClick={() => { setPickerMode('project_select'); setShowPicker(true); }}
                       className="w-full group relative flex items-center gap-4 p-4 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-all"
                   >
                       <div className="w-12 h-12 rounded-lg bg-black flex items-center justify-center border border-zinc-800 group-hover:border-cyan-500/50 transition-colors">
                           <FolderOpen className="w-6 h-6 text-zinc-400 group-hover:text-cyan-400"/>
                       </div>
                       <div className="text-left flex-1">
                           <h3 className="text-white font-bold text-sm">Open Project</h3>
                           <p className="text-zinc-500 text-xs">Select a .platinium folder from Drive</p>
                       </div>
                       <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-white transition-colors"/>
                   </button>

                   <button 
                       onClick={() => setActiveView('create')}
                       className="w-full group relative flex items-center gap-4 p-4 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-all"
                   >
                       <div className="w-12 h-12 rounded-lg bg-black flex items-center justify-center border border-zinc-800 group-hover:border-purple-500/50 transition-colors">
                           <Plus className="w-6 h-6 text-zinc-400 group-hover:text-purple-400"/>
                       </div>
                       <div className="text-left flex-1">
                           <h3 className="text-white font-bold text-sm">Create Project</h3>
                           <p className="text-zinc-500 text-xs">Initialize a new workspace</p>
                       </div>
                       <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-white transition-colors"/>
                   </button>
               </div>
           ) : (
               // CREATE VIEW
               <div className="w-full space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                   <div className="space-y-2">
                       <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Project Name</label>
                       <input 
                           autoFocus
                           value={newProjectName}
                           onChange={e => setNewProjectName(e.target.value)}
                           className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-zinc-600"
                           placeholder="My Research Paper"
                       />
                   </div>
                   
                   <div className="flex gap-3">
                       <button onClick={() => setActiveView('menu')} className="flex-1 py-3 text-zinc-500 hover:text-white font-bold text-xs uppercase tracking-wider">Back</button>
                       <button 
                           onClick={() => { setPickerMode('project_create_loc'); setShowPicker(true); }}
                           disabled={!newProjectName}
                           className="flex-[2] py-3 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-xs uppercase tracking-wider"
                       >
                           Next: Choose Location
                       </button>
                   </div>
               </div>
           )}
       </div>

       <DrivePicker 
           isOpen={showPicker}
           onClose={() => setShowPicker(false)}
           mode={pickerMode}
           isConnected={isConnected}
           onConnect={() => setIsConnected(true)}
           onSelectProject={(id) => {
               if (pickerMode === 'project_select') {
                   handleOpenProject(id);
               } else {
                   handleCreateProject(id);
               }
           }}
       />
    </div>
  );
};
