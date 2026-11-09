/**
 * Agent 领域模型
 * ---------------------------------------------------------------------------
 * 采用「消息 + 分片(part)」的结构保存助手输出：
 * 一次 Agent 运行可能包含推理(reasoning)、工具调用(tool-call) 与文本(text) 交错的内容，
 * 用分片数组可以完整还原运行轨迹，后续接入真实 Agent 时无需改动渲染层。
 */

export type MessageRole = 'system' | 'user' | 'assistant';

export type MessageStatus = 'pending' | 'streaming' | 'done' | 'error';

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ReasoningPart {
  type: 'reasoning';
  text: string;
}

export type ToolCallStatus = 'running' | 'success' | 'error';

export interface ToolCallPart {
  type: 'tool-call';
  id: string;
  name: string;
  args?: unknown;
  status: ToolCallStatus;
  result?: string;
  startedAt: number;
  finishedAt?: number;
}

export type MessagePart = TextPart | ReasoningPart | ToolCallPart;

export interface ChatMessage {
  id: string;
  role: MessageRole;
  parts: MessagePart[];
  status: MessageStatus;
  createdAt: number;
  model?: string;
  /** 结束原因：stop / tool_calls / length / aborted */
  finishReason?: string;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ChatSettings {
  model: string;
  deepThink: boolean;
  webSearch: boolean;
}

export interface ChatRequest {
  conversationId: string;
  /** 本次运行的助手消息 id，由前端生成，后端在事件中原样回传 */
  messageId: string;
  /** 只发送对模型有意义的历史消息；开启工具时 DeepSeek 要求回传 assistant 的推理内容 */
  messages: Array<{ role: MessageRole; content: string; reasoningContent?: string }>;
  settings: ChatSettings;
  signal: AbortSignal;
}

/**
 * 传输层协议事件（SSE / WebSocket 统一为此结构）。
 * 后端只需按此约定推送 JSON 帧，前端即可驱动完整 UI。
 */
export type AgentEvent =
  | { type: 'run.start'; messageId: string; runId: string }
  | { type: 'text.delta'; messageId: string; text: string }
  | { type: 'reasoning.delta'; messageId: string; text: string }
  | {
      type: 'tool.start';
      messageId: string;
      toolCallId: string;
      name: string;
      args?: unknown;
    }
  | {
      type: 'tool.end';
      messageId: string;
      toolCallId: string;
      status: ToolCallStatus;
      result?: string;
    }
  | { type: 'run.end'; messageId: string; finishReason?: string }
  | { type: 'run.error'; messageId: string; message: string };
