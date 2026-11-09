import { describe, expect, it } from 'vitest';
import { applyAgentEvent, messageToPlainText } from './eventReducer';
import type { ChatMessage } from './types';

const base: ChatMessage = {
  id: 'msg_1',
  role: 'assistant',
  parts: [],
  status: 'pending',
  createdAt: 0,
};

describe('applyAgentEvent', () => {
  it('把文本增量累积到同一个分片', () => {
    let message = applyAgentEvent(base, { type: 'run.start', messageId: 'msg_1', runId: 'r1' });
    message = applyAgentEvent(message, { type: 'text.delta', messageId: 'msg_1', text: '你' });
    message = applyAgentEvent(message, { type: 'text.delta', messageId: 'msg_1', text: '好' });

    expect(message.status).toBe('streaming');
    expect(message.parts).toEqual([{ type: 'text', text: '你好' }]);
  });

  it('工具调用会插入工具分片，并在 tool.end 时更新状态', () => {
    let message = applyAgentEvent(base, {
      type: 'tool.start',
      messageId: 'msg_1',
      toolCallId: 'call_1',
      name: 'web_search',
      args: { q: 'agent' },
    });
    message = applyAgentEvent(message, {
      type: 'text.delta',
      messageId: 'msg_1',
      text: '结果如下',
    });
    message = applyAgentEvent(message, {
      type: 'tool.end',
      messageId: 'msg_1',
      toolCallId: 'call_1',
      status: 'success',
      result: 'ok',
    });

    expect(message.parts).toHaveLength(2);
    expect(message.parts[0]).toMatchObject({
      type: 'tool-call',
      name: 'web_search',
      status: 'success',
      result: 'ok',
    });
    expect(messageToPlainText(message)).toBe('结果如下');
  });

  it('推理与正文交替时保持分片顺序', () => {
    let message = applyAgentEvent(base, {
      type: 'reasoning.delta',
      messageId: 'msg_1',
      text: '先想一想',
    });
    message = applyAgentEvent(message, { type: 'text.delta', messageId: 'msg_1', text: '答案' });
    message = applyAgentEvent(message, {
      type: 'reasoning.delta',
      messageId: 'msg_1',
      text: '再补充',
    });

    expect(message.parts.map((part) => part.type)).toEqual(['reasoning', 'text', 'reasoning']);
  });

  it('结束与错误事件会更新消息状态', () => {
    const done = applyAgentEvent(base, {
      type: 'run.end',
      messageId: 'msg_1',
      finishReason: 'stop',
    });
    expect(done.status).toBe('done');

    const failed = applyAgentEvent(base, {
      type: 'run.error',
      messageId: 'msg_1',
      message: '连接失败',
    });
    expect(failed.status).toBe('error');
    expect(failed.error).toBe('连接失败');
  });

  it('忽略不属于当前消息的事件', () => {
    const result = applyAgentEvent(base, { type: 'text.delta', messageId: 'msg_2', text: 'x' });
    expect(result).toBe(base);
  });
});
