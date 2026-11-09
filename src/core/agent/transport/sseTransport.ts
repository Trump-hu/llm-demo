import type { AgentEvent, ChatRequest } from '../types';
import type { ChatTransport } from './ChatTransport';

/**
 * 解析 SSE 文本块，返回完整事件列表与剩余不完整缓冲。
 * 支持 `data: {...}` 多行帧与 `[DONE]` 结束标记。
 */
export function parseSseBuffer(buffer: string): { events: AgentEvent[]; rest: string } {
  const events: AgentEvent[] = [];
  const frames = buffer.split('\n\n');
  const rest = frames.pop() ?? '';

  for (const frame of frames) {
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');
    if (!data || data === '[DONE]') continue;
    try {
      events.push(JSON.parse(data) as AgentEvent);
    } catch {
      // 忽略无法解析的帧，避免单帧脏数据中断整个流
    }
  }

  return { events, rest };
}

/**
 * 基于 fetch + ReadableStream 的 SSE 传输层，对接真实 Agent 网关。
 * 请求体：{ conversationId, messageId, messages, settings }
 * 响应：Content-Type: text/event-stream，每帧为一个 AgentEvent JSON。
 */
export class SseTransport implements ChatTransport {
  readonly id = 'sse';
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async *stream(request: ChatRequest): AsyncGenerator<AgentEvent> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        conversationId: request.conversationId,
        messageId: request.messageId,
        messages: request.messages,
        settings: request.settings,
      }),
      signal: request.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Agent 网关响应异常：HTTP ${response.status}`);
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const { events, rest } = parseSseBuffer(buffer);
        buffer = rest;
        for (const event of events) {
          yield event;
          if (event.type === 'run.end' || event.type === 'run.error') return;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
