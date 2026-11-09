import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentEvent, ChatMessage, ChatSettings, Conversation } from '@/core/agent/types';
import { applyAgentEvent } from '@/core/agent/eventReducer';
import { createId } from '@/shared/utils/id';
import { DEFAULT_MODEL } from '../constants';

export type MessageFeedback = 'like' | 'dislike';

interface StreamingTarget {
  conversationId: string;
  messageId: string;
}

export interface ChatState {
  conversations: Record<string, Conversation>;
  /** 会话排序（最近更新优先），与 conversations 分离便于列表渲染 */
  order: string[];
  activeId: string | null;
  settings: ChatSettings;
  streaming: StreamingTarget | null;
  feedback: Record<string, MessageFeedback>;

  createConversation: (title?: string) => string;
  selectConversation: (id: string | null) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  resetConversations: () => void;
  updateSettings: (patch: Partial<ChatSettings>) => void;

  appendUserMessage: (conversationId: string, content: string) => ChatMessage;
  appendAssistantMessage: (conversationId: string, message: ChatMessage) => void;
  applyEvent: (event: AgentEvent) => void;
  setStreaming: (target: StreamingTarget | null) => void;
  setFeedback: (messageId: string, feedback: MessageFeedback | null) => void;
}

const INITIAL_SETTINGS: ChatSettings = {
  model: DEFAULT_MODEL,
  deepThink: true,
  webSearch: false,
};

function touch(conversation: Conversation): Conversation {
  return { ...conversation, updatedAt: Date.now() };
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversations: {},
      order: [],
      activeId: null,
      settings: INITIAL_SETTINGS,
      streaming: null,
      feedback: {},

      createConversation: (title = '新的对话') => {
        const id = createId('conv');
        const now = Date.now();
        const conversation: Conversation = {
          id,
          title,
          createdAt: now,
          updatedAt: now,
          messages: [],
        };
        set((state) => ({
          conversations: { ...state.conversations, [id]: conversation },
          order: [id, ...state.order],
          activeId: id,
        }));
        return id;
      },

      selectConversation: (id) => set({ activeId: id }),

      deleteConversation: (id) =>
        set((state) => {
          const conversations = { ...state.conversations };
          delete conversations[id];
          const order = state.order.filter((item) => item !== id);
          const activeId = state.activeId === id ? (order[0] ?? null) : state.activeId;
          return { conversations, order, activeId };
        }),

      renameConversation: (id, title) =>
        set((state) => {
          const conversation = state.conversations[id];
          if (!conversation) return state;
          return {
            conversations: {
              ...state.conversations,
              [id]: { ...conversation, title: title.trim() || conversation.title },
            },
          };
        }),

      resetConversations: () => set({ conversations: {}, order: [], activeId: null }),

      updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

      appendUserMessage: (conversationId, content) => {
        const message: ChatMessage = {
          id: createId('msg'),
          role: 'user',
          parts: [{ type: 'text', text: content }],
          status: 'done',
          createdAt: Date.now(),
        };
        set((state) => {
          const conversation = state.conversations[conversationId];
          if (!conversation) return state;
          const isFirst = conversation.messages.length === 0;
          const next = touch({
            ...conversation,
            title: isFirst ? content.replace(/\s+/g, ' ').slice(0, 24) : conversation.title,
            messages: [...conversation.messages, message],
          });
          return {
            conversations: { ...state.conversations, [conversationId]: next },
            order: [conversationId, ...state.order.filter((id) => id !== conversationId)],
          };
        });
        return message;
      },

      appendAssistantMessage: (conversationId, message) =>
        set((state) => {
          const conversation = state.conversations[conversationId];
          if (!conversation) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: touch({
                ...conversation,
                messages: [...conversation.messages, message],
              }),
            },
          };
        }),

      applyEvent: (event) =>
        set((state) => {
          const conversationId =
            state.streaming?.messageId === event.messageId
              ? state.streaming.conversationId
              : state.order.find((id) =>
                  state.conversations[id]?.messages.some((item) => item.id === event.messageId),
                );
          if (!conversationId) return state;

          const conversation = state.conversations[conversationId];
          if (!conversation) return state;
          const index = conversation.messages.findIndex((item) => item.id === event.messageId);
          if (index < 0) return state;

          const messages = [...conversation.messages];
          messages[index] = applyAgentEvent(messages[index]!, event);

          return {
            conversations: {
              ...state.conversations,
              [conversationId]: touch({ ...conversation, messages }),
            },
          };
        }),

      setStreaming: (target) => set({ streaming: target }),

      setFeedback: (messageId, feedback) =>
        set((state) => {
          const next = { ...state.feedback };
          if (feedback) next[messageId] = feedback;
          else delete next[messageId];
          return { feedback: next };
        }),
    }),
    {
      name: 'nexus-agent-chat',
      version: 1,
      partialize: (state) => ({
        conversations: state.conversations,
        order: state.order,
        activeId: state.activeId,
        settings: state.settings,
        feedback: state.feedback,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // 刷新页面后，未完成的流式消息不应停留在 streaming 状态
        const conversations: Record<string, Conversation> = {};
        for (const [id, conversation] of Object.entries(state.conversations)) {
          conversations[id] = {
            ...conversation,
            messages: conversation.messages.map((message) =>
              message.status === 'streaming' || message.status === 'pending'
                ? { ...message, status: 'done' as const }
                : message,
            ),
          };
        }
        useChatStore.setState({ conversations, streaming: null });
      },
    },
  ),
);

export const selectActiveConversation = (state: ChatState): Conversation | undefined =>
  state.activeId ? state.conversations[state.activeId] : undefined;
