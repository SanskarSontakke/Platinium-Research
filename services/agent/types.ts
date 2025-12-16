
import { FunctionDeclaration } from "@google/genai";
import { CanvasData } from "../../types";

export interface AgentTool {
  definition: FunctionDeclaration;
  execute: (args: any, context?: any) => Promise<any>;
}

export interface AgentContext {
  projectId: string; // The ID of the Drive folder for this project
  assetsFolderId?: string; // ID for assets folder
  draftContent: string;
  canvasData?: CanvasData;
  customSources: string[];
  enabledTools: string[];
  currentBrowserUrl?: string;
  imageModel?: 'gemini-2.5-flash-image' | 'imagen-4.0-generate-001';
  imageGenerationMode?: 'generate' | 'prompt_only';
}

export interface ToolExecutionResult {
  callId: string; // Unique ID for the specific tool call instance
  toolName: string;
  input: any;
  output: string;
  meta?: any;
}

export interface AgentCallbacks {
  onToolStart: (callId: string, toolName: string) => void;
  onToolResult: (result: ToolExecutionResult) => void;
  onDraftUpdate?: (content: string) => void;
  onCanvasUpdate?: (data: CanvasData) => void;
  getSessionImages?: () => Record<string, string>;
}
