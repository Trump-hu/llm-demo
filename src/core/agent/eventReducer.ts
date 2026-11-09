import type { AgentEvent, ChatMessage, MessagePart } from './types';

function appendDelta(
  parts: MessagePart[],
  kind: 'text' | 'reasoning',
  delta: string,
): MessagePart[] {
  const last = parts[parts.length - 1];
  if (last?.type === 'text' && kind === 'text') {
    return [...parts.slice(0, -1), { type: 'text', text: last.text + delta }];
  }
  if (last?.type === 'reasoning' && kind === 'reasoning') {
    return [...parts.slice(0, -1), { type: 'reasoning', text: last.text + delta }];
  }
  return [
    ...parts,
    kind === 'text' ? { type: 'text', text: delta } : { type: 'reasoning', text: delta },
  ];
}

/**
 * 纯函数 reducer：把一条传输层事件折叠进目标消息。
 * 与 UI / 状态管理解耦，便于单测与在不同 store 中复用。
 */
export function applyAgentEvent(message: ChatMessage, event: AgentEvent): ChatMessage {
  if (event.messageId !== message.id) return message;

  switch (event.type) {
    case 'run.start':
      return { ...message, status: 'streaming' };

    case 'text.delta':
      return { ...message, parts: appendDelta(message.parts, 'text', event.text) };

    case 'reasoning.delta':
      return { ...message, parts: appendDelta(message.parts, 'reasoning', event.text) };

    case 'tool.start':
      return {
        ...message,
        parts: [
          ...message.parts,
          {
            type: 'tool-call',
            id: event.toolCallId,
            name: event.name,
            args: event.args,
            status: 'running',
            startedAt: Date.now(),
          },
        ],
      };

    case 'tool.end':
      return {
        ...message,
        parts: message.parts.map((part) =>
          part.type === 'tool-call' && part.id === event.toolCallId
            ? {
                ...part,
                status: event.status,
                result: event.result,
                finishedAt: Date.now(),
              }
            : part,
        ),
      };

    case 'run.end':
      return {
        ...message,
        status: 'done',
        finishReason: event.finishReason ?? 'stop',
      };

    case 'run.error':
      return { ...message, status: 'error', error: event.message };

    default:
      return message;
  }
}

/** 取消息的纯文本内容（用于复制、标题生成等） */
export function messageToPlainText(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
}
