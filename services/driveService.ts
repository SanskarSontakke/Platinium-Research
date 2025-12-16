
import { CanvasData, ProjectData, ProjectMetaData, Table } from "../types";
import { STORAGE_KEY } from "../config";

const getToken = () => localStorage.getItem(STORAGE_KEY) || '';

const jsonToBlob = (data: any) => new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
const textToBlob = (text: string) => new Blob([text], { type: 'text/markdown' });
const base64ToBlob = (base64: string, mimeType: string) => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

// --- API HELPERS ---

async function driveFetch(url: string, options: RequestInit = {}) {
  const token = getToken();
  if (!token) throw new Error("No Drive Token Found");

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    if (response.status === 401) throw new Error("TOKEN_EXPIRED");
    throw new Error(`Drive API Error: ${response.statusText}`);
  }
  return response;
}

async function uploadFile(name: string, mimeType: string, parentId: string, contentBlob: Blob) {
  const metadata = {
    name,
    mimeType,
    parents: [parentId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', contentBlob);

  const res = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    body: form
  });
  return await res.json();
}

async function updateFile(fileId: string, contentBlob: Blob) {
  const res = await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    body: contentBlob
  });
  return await res.json();
}

async function readFile(fileId: string): Promise<string> {
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  return await res.text();
}

// --- PROJECT OPERATIONS ---

export const DriveService = {
  
  // 1. Create a new Project (Folder + Files)
  async createProject(name: string, parentId: string = 'root'): Promise<ProjectData> {
    const folderName = name.endsWith('.platinium') ? name : `${name}.platinium`;
    
    // Create Main Project Folder
    const folderMeta = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    };
    
    const folderRes = await driveFetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(folderMeta)
    });
    const folder = await folderRes.json();

    // Create Assets Subfolder
    const assetsMeta = {
      name: 'assets',
      mimeType: 'application/vnd.google-apps.folder',
      parents: [folder.id]
    };
    const assetsRes = await driveFetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assetsMeta)
    });
    const assetsFolder = await assetsRes.json();

    // Create Initial Files
    const draftContent = `# ${name}\n\nProject created via Platinium Research. Start writing...`;
    const canvasContent: CanvasData = { nodes: [], edges: [] };
    const tablesContent: Table[] = [];
    const metaContent: ProjectMetaData = { 
        created: Date.now(), 
        version: 1, 
        settings: {
            imageGenerationMode: 'generate',
            imageModel: 'gemini-2.5-flash-image',
            chatPosition: 'bottom',
            confirmAutoWrite: true,
            confirmCanvas: false,
            confirmImageGen: false
        },
        sources: [],
        chatHistory: []
    };

    const [draftFile, canvasFile, tablesFile, metaFile] = await Promise.all([
      uploadFile('draft.md', 'text/markdown', folder.id, textToBlob(draftContent)),
      uploadFile('canvas.json', 'application/json', folder.id, jsonToBlob(canvasContent)),
      uploadFile('tables.json', 'application/json', folder.id, jsonToBlob(tablesContent)),
      uploadFile('metadata.json', 'application/json', folder.id, jsonToBlob(metaContent))
    ]);

    return {
      id: folder.id,
      assetsFolderId: assetsFolder.id,
      name: folder.name,
      files: {
        draft: { id: draftFile.id, content: draftContent },
        canvas: { id: canvasFile.id, content: canvasContent },
        tables: { id: tablesFile.id, content: tablesContent },
        meta: { id: metaFile.id, content: metaContent }
      }
    };
  },

  // 2. Load an existing Project
  async loadProject(folderId: string): Promise<ProjectData> {
    // Get Folder Details
    const folderRes = await driveFetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name`);
    const folder = await folderRes.json();

    // List Files inside
    const q = `'${folderId}' in parents and trashed = false`;
    const listRes = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)`);
    const list = await listRes.json();
    const files = list.files || [];

    // Find specific files
    const draftFile = files.find((f: any) => f.name === 'draft.md' || f.name === 'draft.txt');
    const canvasFile = files.find((f: any) => f.name === 'canvas.json');
    const tablesFile = files.find((f: any) => f.name === 'tables.json');
    const metaFile = files.find((f: any) => f.name === 'metadata.json');
    
    // Find or Create Assets Folder (Backward compatibility for old projects)
    let assetsFolder = files.find((f: any) => f.name === 'assets' && f.mimeType === 'application/vnd.google-apps.folder');
    
    if (!assetsFolder) {
        // Create if missing
        const assetsMeta = {
          name: 'assets',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [folderId]
        };
        const assetsRes = await driveFetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(assetsMeta)
        });
        assetsFolder = await assetsRes.json();
    }

    if (!draftFile || !canvasFile) {
      throw new Error("Corrupt Project: Missing core files (draft.md or canvas.json)");
    }

    // Read Content
    const [draftContent, canvasText, tablesText, metaText] = await Promise.all([
      readFile(draftFile.id),
      readFile(canvasFile.id),
      tablesFile ? readFile(tablesFile.id) : Promise.resolve('[]'),
      metaFile ? readFile(metaFile.id) : Promise.resolve('{}')
    ]);

    // Parse Meta with defaults
    const parsedMeta = JSON.parse(metaText);
    const safeMeta: ProjectMetaData = {
        created: parsedMeta.created || Date.now(),
        version: parsedMeta.version || 1,
        settings: parsedMeta.settings ? {
             imageGenerationMode: 'generate',
             chatPosition: 'bottom',
             ...parsedMeta.settings
        } : {
            imageGenerationMode: 'generate',
            imageModel: 'gemini-2.5-flash-image',
            chatPosition: 'bottom',
            confirmAutoWrite: true,
            confirmCanvas: false,
            confirmImageGen: false
        },
        sources: parsedMeta.sources || [],
        chatHistory: parsedMeta.chatHistory || []
    };

    // Handle missing tables file by creating a placeholder in memory (will save on next autosave if we had create logic, but for now just empty)
    const tablesId = tablesFile ? tablesFile.id : ''; 

    return {
      id: folder.id,
      assetsFolderId: assetsFolder.id,
      name: folder.name,
      files: {
        draft: { id: draftFile.id, content: draftContent },
        canvas: { id: canvasFile.id, content: JSON.parse(canvasText) },
        tables: { id: tablesId, content: JSON.parse(tablesText) },
        meta: { id: metaFile?.id || '', content: safeMeta }
      }
    };
  },

  // 3. Save Project Components
  async saveDraft(fileId: string, content: string) {
    if(fileId) await updateFile(fileId, textToBlob(content));
  },

  async saveCanvas(fileId: string, data: CanvasData) {
    if(fileId) await updateFile(fileId, jsonToBlob(data));
  },
  
  async saveTables(fileId: string, data: Table[], parentId?: string) {
      if (fileId) {
          await updateFile(fileId, jsonToBlob(data));
      } else if (parentId) {
          // Lazy create if it didn't exist
           await uploadFile('tables.json', 'application/json', parentId, jsonToBlob(data));
      }
  },

  async saveMetadata(fileId: string, data: ProjectMetaData) {
    if (fileId) {
        await updateFile(fileId, jsonToBlob(data));
    }
  },

  // 4. Save/Copy Assets
  async saveAsset(parentId: string, fileName: string, base64Data: string, mimeType: string) {
    const blob = base64ToBlob(base64Data, mimeType);
    return await uploadFile(fileName, mimeType, parentId, blob);
  },

  async copyFile(fileId: string, targetParentId: string) {
    const body = {
      parents: [targetParentId]
    };
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await res.json();
  },

  // 5. List Assets
  async listAssets(folderId: string) {
    const q = `'${folderId}' in parents and trashed = false`;
    const params = new URLSearchParams({
      q,
      fields: 'files(id, name, mimeType, thumbnailLink, iconLink, webContentLink)',
      orderBy: 'createdTime desc',
      pageSize: '100'
    });
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`);
    const data = await res.json();
    return data.files || [];
  },
  
  // 6. Get Asset Content (Base64)
  async getAsset(fileId: string) {
      const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
      const blob = await res.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
           resolve((reader.result as string).split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });
  }
};
