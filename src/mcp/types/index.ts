/**
 * Types for Message Content Protocol (MCP) implementation
 * Based on Anthropic's specification
 */

/**
 * Base interface for all MCP content types
 */
export interface MCPContent {
    type: string;
}

/**
 * MCP text content 
 */
export interface MCPText extends MCPContent {
    type: 'text';
    text: string;
}

/**
 * MCP tool use request
 */
export interface MCPToolUse extends MCPContent {
    type: 'tool_use';
    name: string;
    parameters: Record<string, any>;
    id?: string;
}

/**
 * MCP tool result
 */
export interface MCPToolResult extends MCPContent {
    type: 'tool_result';
    tool_use_id: string;
    result: any;
}

/**
 * Combined MCP content types
 */
export type MCPContentUnion = MCPText | MCPToolUse | MCPToolResult;

/**
 * Tool handler function signature
 */
export type ToolHandler<
    TParams = Record<string, any>,
    TResult = any,
    TContext = Record<string, any>
> = (params: TParams, context: TContext) => Promise<TResult>;

/**
 * Tool registration information
 */
export interface ToolDefinition<TParams = Record<string, any>, TResult = any> {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    returnType?: {
        type: string;
        properties?: Record<string, any>;
    };
    handler: ToolHandler<TParams, TResult>;
}

/**
 * Dispatch result with standardized format
 */
export interface DispatchResult<T = any> {
    success: boolean;
    result?: T;
    error?: string;
    toolUseId?: string;
}

/**
 * Model provider type for generating the tool schema for different LLM providers
 */
export enum ModelProvider {
    ANTHROPIC = 'anthropic',
    OPENAI = 'openai',
    GOOGLE = 'google',
    GENERAL = 'general'
} 