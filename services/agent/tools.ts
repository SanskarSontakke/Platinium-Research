
import { Type } from "@google/genai";
import { AgentTool } from "./types";
import { performWebSearch, performDeepReasoning, analyzeImage, generateCreativePrompt, generateImageFlash, generateImageImagen, generateCitations } from "../geminiService";
import { performYouTubeSearch } from "../youtubeService";
import { DriveService } from "../driveService";
import { CanvasData, Table } from "../../types";

// --- Helper: Fetch and Parse URL Content ---
const fetchUrlContent = async (url: string): Promise<string> => {
  const tryFetch = async (proxyUrl: string) => {
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(response.statusText);
      return await response.text();
  };

  try {
    let html = '';
    // Strategy 1: AllOrigins
    try {
        html = await tryFetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    } catch (e) {
        // Strategy 2: CorsProxy.io (Fallback)
        console.warn("AllOrigins failed, trying fallback...", e);
        html = await tryFetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    }
    
    // Parse HTML to text in the browser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove scripts, styles, and other non-text elements
    const scripts = doc.querySelectorAll('script, style, noscript, iframe, svg, img, video');
    scripts.forEach(script => script.remove());
    
    const text = doc.body.textContent || "";
    
    // Clean up whitespace
    return text.replace(/\s+/g, ' ').trim().substring(0, 20000); // Limit to ~20k chars
  } catch (error: any) {
    return `Error reading website: ${error.message}. The site might be blocking proxy access.`;
  }
};

// --- Tool Definitions & Implementations ---

export const readProjectContextTool: AgentTool = {
  definition: {
    name: 'readProjectContext',
    description: 'Reads the current state of the project files (Draft, Canvas, Assets, Tables). ALWAYS call this at the start of a session or when you need to understand the current progress of the project.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  execute: async ({}, context: any) => {
    // 1. Draft
    const draft = context.draftContent || "";
    
    // 2. Canvas
    const canvas = context.canvasData as CanvasData;
    let canvasSummary = "Canvas is empty.";
    
    if (canvas && canvas.nodes.length > 0) {
        const nodeDescriptions = canvas.nodes.map(n => {
            const attachmentInfo = n.attachments && n.attachments.length > 0 
                ? ` (Attachments: ${n.attachments.map(a => a.name).join(', ')})` 
                : '';
            return `- [${n.type}] ${n.label}${attachmentInfo}`;
        });
        canvasSummary = `Canvas has ${canvas.nodes.length} nodes and ${canvas.edges.length} edges.\nNodes:\n${nodeDescriptions.join('\n')}`;
    }

    // 3. Assets
    let assetsSummary = "No assets linked.";
    if (context.assetsFolderId) {
        try {
            const assets = await DriveService.listAssets(context.assetsFolderId);
            if (assets.length > 0) {
                assetsSummary = `Found ${assets.length} assets: ${assets.map((a: any) => a.name).join(', ')}`;
            } else {
                assetsSummary = "Assets folder is empty.";
            }
        } catch (e) {
            assetsSummary = "Could not list assets (Drive Error).";
        }
    }

    // 4. Tables
    const tables = context.tables || [];
    let tablesSummary = "No data tables.";
    if (tables.length > 0) {
        tablesSummary = tables.map((t: Table) => `- Table '${t.name}' (${t.rows.length} rows, ${t.headers.length} cols)`).join('\n');
    }

    // 5. Custom Sources
    const sources = context.customSources || [];
    const sourcesSummary = sources.length > 0 ? sources.join(', ') : "No custom sources.";

    return {
      text: `## Project Context Analysis\n\n**Draft Content (${draft.length} chars):**\n${draft.length > 500 ? draft.substring(0, 2000) + '...[truncated for summary]' : draft || 'Empty'}\n\n**Canvas Structure:**\n${canvasSummary}\n\n**Data Tables:**\n${tablesSummary}\n\n**Assets:**\n${assetsSummary}\n\n**Sources:**\n${sourcesSummary}`
    };
  }
};

export const manageTablesTool: AgentTool = {
    definition: {
        name: 'manageTables',
        description: 'Create, update, or read data tables (spreadsheets) in the project. Use this for structured data, comparisons, or datasets.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                action: { type: Type.STRING, enum: ['create', 'read', 'update_rows'], description: 'Action to perform.' },
                tableName: { type: Type.STRING, description: 'Name of the table to target.' },
                headers: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Required for "create". List of column headers.' },
                data: { 
                    type: Type.ARRAY, 
                    items: { type: Type.ARRAY, items: { type: Type.STRING } }, 
                    description: 'Rows of data (array of arrays). For "update_rows", these rows are appended.' 
                }
            },
            required: ['action', 'tableName']
        }
    },
    execute: async ({ action, tableName, headers, data }: { action: string, tableName: string, headers?: string[], data?: string[][] }, context: any) => {
        const tables: Table[] = context.tables || [];
        
        if (action === 'create') {
            if (!headers) return { text: "Error: Headers are required to create a table." };
            const newTable: Table = {
                id: `table-${Date.now()}`,
                name: tableName,
                headers: headers,
                rows: data || []
            };
            // Note: The actual state update happens via callback in the Orchestrator
            return {
                text: `Created new table '${tableName}'.`,
                meta: { tables: [...tables, newTable] }
            };
        } else if (action === 'read') {
            const table = tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
            if (!table) return { text: `Error: Table '${tableName}' not found.` };
            
            // Format as Markdown table for the model
            const headerRow = `| ${table.headers.join(' | ')} |`;
            const separator = `| ${table.headers.map(() => '---').join(' | ')} |`;
            const dataRows = table.rows.map(r => `| ${r.join(' | ')} |`).join('\n');
            
            return {
                text: `Table '${table.name}':\n${headerRow}\n${separator}\n${dataRows}`
            };
        } else if (action === 'update_rows') {
            const tableIndex = tables.findIndex(t => t.name.toLowerCase() === tableName.toLowerCase());
            if (tableIndex === -1) return { text: `Error: Table '${tableName}' not found.` };
            
            if (!data) return { text: "Error: No data provided to update." };

            const updatedTables = [...tables];
            updatedTables[tableIndex] = {
                ...updatedTables[tableIndex],
                rows: [...updatedTables[tableIndex].rows, ...data]
            };

            return {
                text: `Added ${data.length} rows to table '${tableName}'.`,
                meta: { tables: updatedTables }
            };
        }

        return { text: "Invalid action." };
    }
};

export const searchTool: AgentTool = {
  definition: {
    name: 'searchWeb',
    description: 'Searches the live web for facts, statistics, recent news, or citations.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'The search query string.' },
      },
      required: ['query'],
    },
  },
  execute: async ({ query }: { query: string }) => {
    const result = await performWebSearch(query);
    return {
      text: result.text,
      meta: { sources: result.sources }
    };
  }
};

export const updateDraftTool: AgentTool = {
  definition: {
    name: 'updateDraft',
    description: 'WRITES, EDITS, or APPENDS content to the main document canvas. You can either overwrite the whole file OR replace a specific section using "patch" mode for efficiency.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: { type: Type.STRING, enum: ['overwrite', 'patch'], description: 'Use "patch" to replace specific text, "overwrite" to replace the whole document. Default to "patch" for small edits.' },
        content: { type: Type.STRING, description: 'The new content. If mode is "patch", this replaces the search_text. If mode is "overwrite", this is the full document.' },
        search_text: { type: Type.STRING, description: 'REQUIRED if mode is "patch". The exact existing text segment to find and replace. Be precise.' },
        change_summary: { type: Type.STRING, description: 'A short summary of what was changed.' }
      },
      required: ['mode', 'content', 'change_summary'],
    },
  },
  execute: async ({ mode, content, search_text, change_summary }: { mode: string, content: string, search_text?: string, change_summary: string }, context: any) => {
    let finalContent = content;
    
    if (mode === 'patch' && search_text) {
        const currentDraft = context.draftContent || "";
        // Simple string replace. 
        if (currentDraft.includes(search_text)) {
            finalContent = currentDraft.replace(search_text, content);
        } else {
             // Fallback: If strict match fails, try to normalize whitespace or return error
             // For now, return error so model can retry or choose overwrite
             return {
                 text: `Error: Could not find the exact text segment to patch. Please ensure 'search_text' matches exactly or use 'overwrite' mode.`
             };
        }
    }

    // The actual state update happens in the UI callback, this just returns a success message to the model
    return {
      text: `Draft updated successfully (${mode} mode). Summary: ${change_summary}.`,
      meta: { content: finalContent }
    };
  }
};

export const deepReasonTool: AgentTool = {
  definition: {
    name: 'deepReason',
    description: 'Uses a high-compute reasoning engine to PLAN outlines, SOLVE logic puzzles, or CRITIQUE arguments before writing.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        problem: { type: Type.STRING, description: 'The complex problem or topic to reason about.' },
      },
      required: ['problem'],
    },
  },
  execute: async ({ problem }: { problem: string }) => {
    const result = await performDeepReasoning(problem);
    return { text: result };
  }
};

export const citeSourcesTool: AgentTool = {
  definition: {
    name: 'citeSources',
    description: 'Analyzes text (or the current draft) and inserts academic citations/bibliography based on the available project sources. Use this when the user asks to "cite sources", "add references", or "fix citations".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: 'The text to analyze. If empty, the current draft content will be used.' },
        style: { type: Type.STRING, enum: ['APA', 'MLA', 'Chicago', 'IEEE'], description: 'The citation style to use. Default is APA.' }
      },
    },
  },
  execute: async ({ text, style }: { text?: string, style?: string }, context?: any) => {
    const contentToCite = text || context?.draftContent || "";
    if (!contentToCite) return { text: "Error: No text provided and draft is empty." };

    const sources = context?.customSources || [];
    
    // Also include assets in the source list for context
    let assetNames: string[] = [];
    if (context?.assetsFolderId) {
        try {
            const assets = await DriveService.listAssets(context.assetsFolderId);
            assetNames = assets.map((a: any) => `Asset: ${a.name}`);
        } catch (e) {
            // Ignore asset error
        }
    }
    
    const allSources = [...sources, ...assetNames];
    
    const citedText = await generateCitations(contentToCite, allSources, style || 'APA');
    
    return {
        text: `Citations generated (${style || 'APA'}).\n\nPreview:\n${citedText.substring(0, 300)}...`,
        meta: { 
            citedContent: citedText,
            sourcesUsed: allSources.length 
        }
    };
  }
};

export const analyzeImageTool: AgentTool = {
  definition: {
    name: 'analyzeImage',
    description: 'Analyzes a user-uploaded image (referenced by ID) to extract text, describe charts, or identify objects.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        imageId: { type: Type.STRING, description: 'The ID of the image to analyze (e.g., "image_0").' },
        question: { type: Type.STRING, description: 'Specific question about the image.' },
      },
      required: ['imageId', 'question'],
    },
  },
  execute: async ({ imageId, question }: { imageId: string, question: string }, context?: any) => {
    const base64Data = context?.sessionImages?.[imageId];
    if (!base64Data) return { text: `Error: Image ID ${imageId} not found in current session context.` };
    
    const result = await analyzeImage(base64Data, 'image/png', question);
    return { text: result };
  }
};

export const generateImageTool: AgentTool = {
  definition: {
    name: 'generateImage',
    description: 'Generates an image OR detailed prompts based on user settings.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: 'The user\'s basic concept for the image.' }
      },
      required: ['prompt']
    }
  },
  execute: async ({ prompt }: { prompt: string }, context?: any) => {
    const mode = context?.imageGenerationMode || 'generate';
    const model = context?.imageModel || 'gemini-2.5-flash-image';

    try {
      // 1. Prompt Only Mode
      if (mode === 'prompt_only') {
        const detailedPrompts = await generateCreativePrompt(prompt);
        return {
          text: `I have crafted detailed prompts for your Pro account tools:\n\n${detailedPrompts}`
        };
      }

      // 2. Generation Mode
      let imageData;
      if (model === 'imagen-4.0-generate-001') {
         imageData = await generateImageImagen(prompt);
      } else {
         imageData = await generateImageFlash(prompt);
      }

      return {
        text: `Generated image using ${model === 'imagen-4.0-generate-001' ? 'Imagen 3' : 'Gemini Flash'}.`,
        meta: { 
           generatedImage: imageData // Contains { base64, mimeType }
        }
      };

    } catch (e: any) {
      return { text: `Image Generation failed: ${e.message}` };
    }
  }
};

export const generateCanvasTool: AgentTool = {
  definition: {
    name: 'generateCanvas',
    description: 'Generates a visual NODE-GRAPH on the user canvas. Use this to visualize relationships, workflows, hierarchies, or mind maps.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['concept', 'process', 'note'] },
              color: { type: Type.STRING, description: 'Optional Hex color code for the node border (e.g. #ff0000)' }
            },
            required: ['id', 'label', 'type']
          }
        },
        edges: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              from: { type: Type.STRING },
              to: { type: Type.STRING },
              label: { type: Type.STRING },
              color: { type: Type.STRING, description: 'Optional Hex color code for the connection line' }
            },
            required: ['from', 'to']
          }
        },
        topic_summary: { type: Type.STRING, description: 'Brief description of what this graph represents.' }
      },
      required: ['nodes', 'edges', 'topic_summary']
    }
  },
  execute: async (args: any) => {
    const data: CanvasData = {
      nodes: args.nodes.map((n: any) => ({ ...n, x: 0, y: 0 })), // X/Y will be calculated by UI layout engine
      edges: args.edges.map((e: any) => ({ ...e, id: `${e.from}-${e.to}` }))
    };
    return {
      text: `Canvas updated with ${data.nodes.length} nodes and ${data.edges.length} edges about: ${args.topic_summary}`,
      meta: { canvasData: data }
    };
  }
};

export const youTubeTool: AgentTool = {
  definition: {
    name: 'searchYouTube',
    description: 'Searches YouTube for educational videos, lectures, tutorials, or visual explanations. Use this to find specific video content to show the user.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'The search query for video content. Be specific.' }
      },
      required: ['query']
    }
  },
  execute: async ({ query }: { query: string }) => {
    try {
        const result = await performYouTubeSearch(query);
        return {
          text: `Found ${result.videos.length} videos:\n\n${result.text}`,
          meta: { videos: result.videos }
        };
    } catch (e: any) {
        return { text: `YouTube Search Unavailable: ${e.message}` };
    }
  }
};

export const readUrlTool: AgentTool = {
  definition: {
    name: 'readWebPage',
    description: 'Reads the specific text content of a URL. Use this to summarize a specific website, read the user\'s current browser page, or analyze a link.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: 'The full URL to read. If the user refers to "this page" or "the browser", use the string "CURRENT_BROWSER_URL".' }
      },
      required: ['url']
    }
  },
  execute: async ({ url }: { url: string }, context?: any) => {
    const targetUrl = url === 'CURRENT_BROWSER_URL' ? context?.currentBrowserUrl : url;
    
    if (!targetUrl || targetUrl === 'about:blank') {
      return { text: "Error: No URL provided or the browser is blank." };
    }

    const content = await fetchUrlContent(targetUrl);
    return {
      text: `Content of ${targetUrl}:\n\n${content}`,
      meta: { url: targetUrl }
    };
  }
};
