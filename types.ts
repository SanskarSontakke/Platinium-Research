
export enum AppMode {
  RESEARCH_WRITE = 'RESEARCH_WRITE',
}

export interface Attachment {
  id: string;
  type: 'image' | 'pdf' | 'text';
  mime: string;
  data: string; // Base64 for binary, string for text
  name: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  toolActivity?: { id?: string; type: string; label: string; status: 'running' | 'done' | 'pending'; output?: string; meta?: any }[];
  isError?: boolean;
  attachments?: Attachment[];
}

export interface AppSettings {
  imageGenerationMode: 'generate' | 'prompt_only';
  imageModel: 'gemini-2.5-flash-image' | 'imagen-4.0-generate-001';
  chatPosition: 'bottom' | 'right';
  confirmAutoWrite: boolean;
  confirmCanvas: boolean;
  confirmImageGen: boolean;
}

export interface ResearchPaper {
  id: string;
  title: string;
  content: string;
  lastModified: number;
}

export interface CanvasNode {
  id: string;
  label: string;
  type: 'concept' | 'process' | 'note';
  x: number;
  y: number;
  content?: string;
  color?: string;
  attachments?: Attachment[];
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  color?: string;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'area';
  xAxisCol: number;
  dataCols: number[];
}

export interface Table {
  id: string;
  name: string;
  headers: string[];
  columnTypes?: string[]; // 'text' | 'number' | 'date'
  rows: string[][];
  chartConfig?: ChartConfig;
}

export interface ProjectMetaData {
  created: number;
  version: number;
  settings?: AppSettings;
  sources?: string[]; // List of URLs or citations
  chatHistory?: ChatMessage[];
}

export interface ProjectData {
  id: string; // The Drive Folder ID
  assetsFolderId: string; // Subfolder for assets
  name: string;
  files: {
    draft: { id: string; content: string };
    canvas: { id: string; content: CanvasData };
    tables: { id: string; content: Table[] };
    meta: { id: string; content: ProjectMetaData };
  };
}
