import { useCallback, useEffect, useRef } from 'react';
import { createChatTransport } from '@/core/agent';
import { messageToPlainText } from '@/core/agent/eventReducer';
import type { AgentEvent, ChatMessage, MessageRole } from '@/core/agent/types';
import { createId } from '@/shared/utils/id';
import { useChatStore } from '../store/chatStore';

const transport = createChatTransport();

function reasoningToText(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === 'reasoning')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function toHistory(messages: ChatMessage[]): Array<{
  role: MessageRole;
  content: string;
  reasoningContent?: string;
}> {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      const content = messageToPlainText(message);
      const reasoningContent = message.role === 'assistant' ? reasoningToText(message) : '';
      return {
        role: message.role,
        content,
        ...(reasoningContent ? { reasoningContent } : {}),
      };
    })
    .filter((message) => message.content.length > 0 || message.reasoningContent);
}

interface PendingDelta {
  kind: 'text' | 'reasoning';
  messageId: string;
  text: string;
}

/** 合并高频 token 增量：最多每 40ms 或每 48 个字符刷新一次，避免每个 token 都触发渲染 */
const DELTA_FLUSH_INTERVAL_MS = 40;
const DELTA_FLUSH_CHARS = 48;

/**
 * 对话运行编排：把「用户输入 → 助手消息占位 → 事件流 → store 折叠」串起来。
 * 组件层只需调用 send / stop / regenerate。
 */
export function useAgentRun() {
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runAgent = useCallback(async (conversationId: string) => {
    const store = useChatStore.getState();
    const conversation = store.conversations[conversationId];
    if (!conversation) return;

    const assistantMessage: ChatMessage = {
      id: createId('msg'),
      role: 'assistant',
      parts: [],
      status: 'pending',
      createdAt: Date.now(),
      model: store.settings.model,
    };

    useChatStore.getState().appendAssistantMessage(conversationId, assistantMessage);
    useChatStore.getState().setStreaming({
      conversationId,
      messageId: assistantMessage.id,
    });

    const controller = new AbortController();
    abortRef.current = controller;

    let pending: PendingDelta | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (!pending) return;

      const { kind, messageId, text } = pending;
      pending = null;
      useChatStore
        .getState()
        .applyEvent(
          kind === 'text'
            ? { type: 'text.delta', messageId, text }
            : { type: 'reasoning.delta', messageId, text },
        );
    };

    const scheduleFlush = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(flush, DELTA_FLUSH_INTERVAL_MS);
    };

    const handleEvent = (event: AgentEvent) => {
      if (event.type !== 'text.delta' && event.type !== 'reasoning.delta') {
        flush();
        useChatStore.getState().applyEvent(event);
        return;
      }

      const kind = event.type === 'text.delta' ? 'text' : 'reasoning';
      if (pending && pending.kind === kind && pending.messageId === event.messageId) {
        pending.text += event.text;
      } else {
        flush();
        pending = { kind, messageId: event.messageId, text: event.text };
      }

      if (pending.text.length >= DELTA_FLUSH_CHARS) flush();
      else scheduleFlush();
    };

    try {
      const stream = transport.stream({
        conversationId,
        messageId: assistantMessage.id,
        messages: toHistory(conversation.messages),
        settings: store.settings,
        signal: controller.signal,
      });

      for await (const event of stream) {
        handleEvent(event);
      }
      flush();

      const current = useChatStore
        .getState()
        .conversations[conversationId]?.messages.find((item) => item.id === assistantMessage.id);
      if (current?.status === 'streaming' || current?.status === 'pending') {
        useChatStore.getState().applyEvent({
          type: 'run.end',
          messageId: assistantMessage.id,
          finishReason: 'stop',
        });
      }
    } catch (error) {
      flush();
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      useChatStore.getState().applyEvent(
        aborted
          ? { type: 'run.end', messageId: assistantMessage.id, finishReason: 'aborted' }
          : {
              type: 'run.error',
              messageId: assistantMessage.id,
              message: error instanceof Error ? error.message : '未知错误',
            },
      );
    } finally {
      flush();
      useChatStore.getState().setStreaming(null);
      abortRef.current = null;
    }
  }, []);

  const send = useCallback(
    (text: string): string | null => {
      const content = text.trim();
      const state = useChatStore.getState();
      if (!content || state.streaming) return null;

      let conversationId = state.activeId;
      if (!conversationId || !state.conversations[conversationId]) {
        conversationId = state.createConversation();
      }

      useChatStore.getState().appendUserMessage(conversationId, content);
      // 流式过程在后台推进，UI 立即拿到会话 id 以便更新路由
      void runAgent(conversationId);
      return conversationId;
    },
    [runAgent],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  /** 重新生成：删除该条助手消息及其后续内容，基于已有上下文重跑 */
  const regenerate = useCallback(
    async (messageId: string) => {
      const state = useChatStore.getState();
      if (state.streaming) return;

      for (const id of state.order) {
        const conversation = state.conversations[id];
        const index = conversation?.messages.findIndex((item) => item.id === messageId) ?? -1;
        if (!conversation || index < 0) continue;

        useChatStore.setState({
          conversations: {
            ...state.conversations,
            [id]: { ...conversation, messages: conversation.messages.slice(0, index) },
          },
        });
        await runAgent(id);
        return;
      }
    },
    [runAgent],
  );

  return { send, stop, regenerate };
}
