import type { ChatTransport } from './ChatTransport';
import { DeepSeekTransport } from './deepseekTransport';
import { MockTransport } from './mockTransport';
import { SseTransport } from './sseTransport';

export type TransportKind = 'mock' | 'sse' | 'deepseek';

/**
 * 传输层工厂：自建网关（VITE_API_BASE）> DeepSeek（VITE_DEEPSEEK_BASE_URL）> 内置 mock。
 */
export function createChatTransport(): ChatTransport {
  const gateway = import.meta.env.VITE_API_BASE?.trim();
  if (gateway) {
    return new SseTransport(`${gateway.replace(/\/$/, '')}/agent/chat`);
  }

  const deepseekBase = import.meta.env.VITE_DEEPSEEK_BASE_URL?.trim();
  if (deepseekBase) {
    return new DeepSeekTransport({
      baseUrl: deepseekBase,
      apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY?.trim() || undefined,
      defaultModel: import.meta.env.VITE_DEEPSEEK_MODEL?.trim() || undefined,
    });
  }

  return new MockTransport();
}

export { DeepSeekTransport, MockTransport, SseTransport };
export type { ChatTransport };
