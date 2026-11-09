import { useCallback, useEffect, useRef } from 'react';
import { createChatTransport } from '@/core/agent';
import { messageToPlainText } from '@/core/agent/eventReducer';
import type { ChatMessage, MessageRole } from '@/core/agent/types';
import { createId } from '@/shared/utils/id';
import { useChatStore } from '../store/chatStore';

const transport = createChatTransport();

function toHistory(messages: ChatMessage[]): Array<{ role: MessageRole; content: string }> {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role, content: messageToPlainText(message) }))
    .filter((message) => message.content.length > 0);
}

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

    try {
      const stream = transport.stream({
        conversationId,
        messageId: assistantMessage.id,
        messages: toHistory(conversation.messages),
        settings: store.settings,
        signal: controller.signal,
      });

      for await (const event of stream) {
        useChatStore.getState().applyEvent(event);
      }

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
