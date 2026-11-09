import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/core/agent/types';
import { useChatStore } from './chatStore';

const assistant: ChatMessage = {
  id: 'msg_a',
  role: 'assistant',
  parts: [],
  status: 'pending',
  createdAt: Date.now(),
};

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.setState({
      conversations: {},
      order: [],
      activeId: null,
      streaming: null,
      feedback: {},
    });
  });

  it('新建会话后自动成为当前会话', () => {
    const id = useChatStore.getState().createConversation();
    const state = useChatStore.getState();

    expect(state.activeId).toBe(id);
    expect(state.order[0]).toBe(id);
    expect(state.conversations[id]?.messages).toEqual([]);
  });

  it('首条用户消息会生成会话标题', () => {
    const id = useChatStore.getState().createConversation();
    useChatStore.getState().appendUserMessage(id, '帮我设计一个 Agent 工作流并拆解步骤');

    expect(useChatStore.getState().conversations[id]?.title).toBe(
      '帮我设计一个 Agent 工作流并拆解步骤',
    );
  });

  it('事件流会被折叠到对应的助手消息上', () => {
    const id = useChatStore.getState().createConversation();
    useChatStore.getState().appendUserMessage(id, '你好');
    useChatStore.getState().appendAssistantMessage(id, assistant);
    useChatStore.getState().setStreaming({ conversationId: id, messageId: assistant.id });

    useChatStore.getState().applyEvent({ type: 'text.delta', messageId: assistant.id, text: '嗨' });
    useChatStore.getState().applyEvent({
      type: 'run.end',
      messageId: assistant.id,
      finishReason: 'stop',
    });

    const message = useChatStore.getState().conversations[id]?.messages.at(-1);
    expect(message?.status).toBe('done');
    expect(message?.parts).toEqual([{ type: 'text', text: '嗨' }]);
  });

  it('删除会话后自动切换到剩余会话', () => {
    const first = useChatStore.getState().createConversation('A');
    const second = useChatStore.getState().createConversation('B');

    useChatStore.getState().deleteConversation(second);

    const state = useChatStore.getState();
    expect(state.conversations[second]).toBeUndefined();
    expect(state.activeId).toBe(first);
  });
});
