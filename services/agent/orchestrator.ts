
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { AgentContext, AgentTool, ToolExecutionResult, AgentCallbacks } from "./types";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./prompts";
import * as Tools from "./tools";

// Map string names to actual tool implementations
const TOOL_REGISTRY: Record<string, AgentTool> = {
  'searchWeb': Tools.searchTool,
  'updateDraft': Tools.updateDraftTool,
  'deepReason': Tools.deepReasonTool,
  'analyzeImage': Tools.analyzeImageTool,
  'generateImage': Tools.generateImageTool,
  'generateCanvas': Tools.generateCanvasTool,
  'searchYouTube': Tools.youTubeTool,
  'readWebPage': Tools.readUrlTool,
  'readProjectContext': Tools.readProjectContextTool,
  'citeSources': Tools.citeSourcesTool,
  'manageTables': Tools.manageTablesTool,
};

export class AgentOrchestrator {
  private chat: Chat;
  private tools: AgentTool[];
  private ai: GoogleGenAI;
  private context: AgentContext;

  constructor(apiKey: string, history: any[], context: AgentContext) {
    this.ai = new GoogleGenAI({ apiKey });
    this.context = context;
    
    // 1. Resolve Enabled Tools
    this.tools = context.enabledTools
      .map(name => TOOL_REGISTRY[name])
      .filter(Boolean);

    // 2. Build System Prompt
    const toolDescriptions = this.tools
      .map(t => `- **${t.definition.name}**: ${t.definition.description}`)
      .join('\n');

    let instruction = ORCHESTRATOR_SYSTEM_PROMPT(
      toolDescriptions || "No tools enabled.", 
      context.customSources
    );

    // Inject Browser Context
    if (context.currentBrowserUrl) {
      instruction += `\n# CURRENT CONTEXT\nThe user has the following URL open in their internal browser: "${context.currentBrowserUrl}".\nIf they ask to "read this page", "summarize this", or "look at the website", use the \`readWebPage\` tool with the url argument "CURRENT_BROWSER_URL".`;
    }

    // 3. Initialize Chat
    this.chat = this.ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: instruction,
        tools: this.tools.length > 0 
          ? [{ functionDeclarations: this.tools.map(t => t.definition) }] 
          : undefined,
        thinkingConfig: { thinkingBudget: 32768 }, // Max budget for deep thinking
      },
      history: history
    });
  }

  /**
   * Main execution loop.
   * Handles multi-step reasoning: User Input -> [Model -> Tool -> Model]... -> Final Response
   */
  async sendMessage(
    message: any[], 
    callbacks: AgentCallbacks
  ): Promise<string> {
    
    // 1. INTENT DETECTION
    // Analyze what the user likely wants to ensure we don't exit early
    const userText = message.map((p: any) => p.text || '').join(' ').toLowerCase();
    
    const requiredTools = new Set<string>();
    // Heuristic detection of mandatory tools based on prompt keywords
    if (userText.includes('draft') || userText.includes('write') || userText.includes('paper') || userText.includes('report')) {
        requiredTools.add('updateDraft');
    }
    if (userText.includes('canvas') || userText.includes('diagram') || userText.includes('graph') || userText.includes('map') || userText.includes('visualize')) {
        requiredTools.add('generateCanvas');
    }
    // "Reasoning" is often internal, but if explicitly asked:
    if (userText.includes('reason') || userText.includes('deep') || userText.includes('think') || userText.includes('plan')) {
        requiredTools.add('deepReason');
    }
    // Image Generation
    if ((userText.includes('create') || userText.includes('generate')) && (userText.includes('image') || userText.includes('picture') || userText.includes('photo'))) {
       requiredTools.add('generateImage');
    }

    const toolsExecuted = new Set<string>();
    const toolCallCache = new Map<string, any>(); // Cache for deduping identical calls in same turn

    let currentResponse: GenerateContentResponse = await this._retryRequest(() => this.chat.sendMessage({ message }));
    let loopCount = 0;
    const MAX_LOOPS = 15;

    // --- The Agent Loop ---
    while (loopCount < MAX_LOOPS) {
      loopCount++;

      // CASE A: Function Call(s)
      if (
        currentResponse.functionCalls && 
        currentResponse.functionCalls.length > 0
      ) {
          const functionResponses: any[] = [];
          
          // Cap at 3 parallel calls if the model tries to do too many, though prompt suggests 3
          // The API structure allows iterating all of them.
          const callsToExecute = currentResponse.functionCalls;

          // Execute ALL calls in parallel
          await Promise.all(callsToExecute.map(async (call) => {
              const toolName = call.name;
              const toolArgs = call.args;
              const callId = call.id || `${toolName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const cacheKey = `${toolName}:${JSON.stringify(toolArgs)}`;

              toolsExecuted.add(toolName);

              let toolOutput: any;

              // Dedup check: If exact same tool+args called previously in this session, reuse result
              if (toolCallCache.has(cacheKey)) {
                  toolOutput = toolCallCache.get(cacheKey);
              } else {
                  // New Execution
                  callbacks.onToolStart(callId, toolName);

                  try {
                    const toolImpl = TOOL_REGISTRY[toolName];
                    if (toolImpl) {
                      const executionContext = {
                          sessionImages: callbacks.getSessionImages?.() || {},
                          currentBrowserUrl: this.context.currentBrowserUrl,
                          projectId: this.context.projectId,
                          assetsFolderId: this.context.assetsFolderId,
                          draftContent: this.context.draftContent, // Pass draft content
                          canvasData: this.context.canvasData, // Pass canvas data
                          tables: (this.context as any).tables, // Pass tables
                          customSources: this.context.customSources // Pass sources
                      };

                      toolOutput = await toolImpl.execute(toolArgs, executionContext);

                      // Handle Tool Specific Side Effects
                      if (toolName === 'updateDraft' && toolOutput.meta?.content && callbacks.onDraftUpdate) {
                        callbacks.onDraftUpdate(toolOutput.meta.content);
                      }
                      if (toolName === 'generateCanvas' && toolOutput.meta?.canvasData && callbacks.onCanvasUpdate) {
                        callbacks.onCanvasUpdate(toolOutput.meta.canvasData);
                      }
                      if (toolName === 'manageTables' && toolOutput.meta?.tables && (callbacks as any).onTablesUpdate) {
                        (callbacks as any).onTablesUpdate(toolOutput.meta.tables);
                      }

                    } else {
                      toolOutput = { text: `Error: Tool '${toolName}' is not available.` };
                    }
                  } catch (err: any) {
                    console.error(`Tool ${toolName} failed:`, err);
                    toolOutput = { text: `Error executing tool: ${err.message}` };
                  }

                  // Cache the result
                  toolCallCache.set(cacheKey, toolOutput);

                  // Notify UI of result
                  callbacks.onToolResult({
                    callId,
                    toolName,
                    input: toolArgs,
                    output: toolOutput.text || JSON.stringify(toolOutput),
                    meta: toolOutput.meta
                  });
              }

              // Feed result back to model
              // Strip heavy meta data to prevent token errors.
              const responseToSend = { ...toolOutput };
              if (responseToSend.meta) {
                  delete responseToSend.meta;
              }

              functionResponses.push({
                functionResponse: {
                  name: toolName,
                  response: { result: responseToSend },
                  id: callId
                }
              });
          }));

          // Send all function responses back in one go
          // This ensures the model receives all 3 tool outputs before generating the next step
          try {
            currentResponse = await this._retryRequest(() => this.chat.sendMessage({
              message: functionResponses
            }));
          } catch (e) {
            console.error("Failed to send tool response:", e);
            break;
          }
          
          continue; // Loop immediately to handle next response
      }

      // CASE B: Model returned text (thinks it's done)
      // SELF-CORRECTION: Check if mandatory tools were missed
      const missingTools = Array.from(requiredTools).filter(t => !toolsExecuted.has(t));
      
      // Filter out tools that might not be enabled in context
      const validMissingTools = missingTools.filter(t => TOOL_REGISTRY[t] !== undefined);

      if (validMissingTools.length > 0) {
          console.log(`[Supervisor] Agent tried to exit but missed: ${validMissingTools.join(', ')}`);
          
          const nextTool = validMissingTools[0];
          const supervisorPrompt = `[SYSTEM SUPERVISOR]: You have NOT completed the user's request yet. 
          You must execute the '${nextTool}' tool before finishing. 
          Execute '${nextTool}' now based on the previous context. Do not apologize.`;

          // Generate placeholder ID for UI
          callbacks.onToolStart(`supervisor-${Date.now()}`, nextTool); 

          try {
             // Force the model back into the loop
             currentResponse = await this._retryRequest(() => this.chat.sendMessage({ 
                 message: [{ text: supervisorPrompt }] 
             }));
             continue; // Resume loop with new response
          } catch (e) {
             console.error("Supervisor intervention failed", e);
             break;
          }
      }

      // If we get here, no function calls and no missing mandatory tools
      break;
    }

    // Return final text
    let finalText = currentResponse.text || "";
    
    // Safety Fallback: If model did work but returned no text
    if (!finalText && loopCount > 0) {
       finalText = "I have completed the requested actions.";
    }

    return finalText;
  }

  // Robust Retry for 429s
  private async _retryRequest<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (e: any) {
        const isQuota = e?.message?.includes('429') || e?.status === 'RESOURCE_EXHAUSTED';
        if (isQuota && i < retries - 1) {
          const delay = 2000 * Math.pow(2, i);
          console.warn(`Quota hit. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw e;
      }
    }
    throw new Error("API Request Failed after retries.");
  }
}
