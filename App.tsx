
import React, { useState } from 'react';
import ResearchWriteView from './components/ResearchWriteView';
import { ProjectManager } from './components/ProjectManager';
import { ProjectData } from './types';
import { Logo } from './components/Logo';

const App: React.FC = () => {
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);

  return (
    <div className="flex h-screen w-screen bg-black text-white font-sans overflow-hidden">
      {/* Top Bar for Mobile / Branding */}
      <div className="absolute top-0 left-0 p-4 z-50 md:hidden pointer-events-none">
        <div className="w-10 h-10 bg-black/80 backdrop-blur rounded-xl border border-zinc-800 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
          <Logo className="w-6 h-6" />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-hidden relative bg-black">
        {currentProject ? (
           <ResearchWriteView project={currentProject} />
        ) : (
           <ProjectManager onProjectLoaded={setCurrentProject} />
        )}
      </main>
    </div>
  );
};

export default App;
