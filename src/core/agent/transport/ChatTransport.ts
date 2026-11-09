import type { AgentEvent, ChatRequest } from '../types';

/**
 * 传输层契约。
 * 任意实现（mock / SSE / WebSocket / 本地 WASM Agent）都只需产出 AgentEvent 流，
 * UI 与 store 不感知具体协议。
 */
export interface ChatTransport {
  readonly id: string;
  stream(request: ChatRequest): AsyncIterable<AgentEvent>;
}
