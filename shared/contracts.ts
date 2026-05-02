// Purpose: Shared type contracts for ContextSwitch project
// Input: Used by backend, extension, and agent for type safety
// Output: TypeScript interfaces for core data structures

/**
 * FileChangeEvent
 * Purpose: Represents a file change event sent from the extension to the backend.
 */
export interface FileChangeEvent {
  type: "file:change";
  filePath: string;
}

/**
 * BrainDump
 * Purpose: Represents a braindump payload sent to the backend for context storage.
 */
export interface BrainDump {
  sessionId: string;
  content: string;
  timestamp: string;
}

/**
 * ReconstructionResponse
 * Purpose: Response structure for reconstructing project context.
 */
export interface ReconstructionResponse {
  projectId: string;
  brief: string;
  confidence: number;
}
