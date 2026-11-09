import type { ChatTransport } from './ChatTransport';
import { MockTransport } from './mockTransport';
import { SseTransport } from './sseTransport';

export type TransportKind = 'mock' | 'sse';

/**
 * 传输层工厂：存在 VITE_API_BASE 时走真实网关，否则回退到内置 mock。
 */
export function createChatTransport(): ChatTransport {
  const base = import.meta.env.VITE_API_BASE?.trim();
  if (base) {
    return new SseTransport(`${base.replace(/\/$/, '')}/agent/chat`);
  }
  return new MockTransport();
}

export { MockTransport, SseTransport };
export type { ChatTransport };
