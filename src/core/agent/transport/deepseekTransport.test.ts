import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentEvent, ChatRequest } from '../types';
import { DeepSeekTransport, parseDeepSeekSse } from './deepseekTransport';

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function createRequest(): ChatRequest {
  return {
    conversationId: 'conv_1',
    messageId: 'msg_1',
    messages: [{ role: 'user', content: '你好' }],
    settings: { model: 'deepseek-reasoner', deepThink: true, webSearch: false },
    signal: new AbortController().signal,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseDeepSeekSse', () => {
  it('解析完整帧并保留未收尾的残帧', () => {
    const payload =
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"好"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"！"';

    const { chunks, rest, done } = parseDeepSeekSse(payload);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.choices?.[0]?.delta?.content).toBe('你');
    expect(rest).toBe('data: {"choices":[{"delta":{"content":"！"');
    expect(done).toBe(false);
  });

  it('识别 [DONE] 并忽略损坏的帧', () => {
    const payload = 'data: not-json\n\ndata: [DONE]\n\n';

    const { chunks, done } = parseDeepSeekSse(payload);

    expect(chunks).toEqual([]);
    expect(done).toBe(true);
  });

  it('兼容 CRLF 分隔并解析 reasoning_content', () => {
    const payload =
      'data: {"choices":[{"delta":{"reasoning_content":"先想"}}]}\r\n\r\n' +
      'data: {"choices":[{"delta":{"content":"再答"},"finish_reason":"stop"}]}\r\n\r\n';

    const { chunks, rest } = parseDeepSeekSse(payload);

    expect(rest).toBe('');
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.choices?.[0]?.delta?.reasoning_content).toBe('先想');
    expect(chunks[1]?.choices?.[0]?.finish_reason).toBe('stop');
  });
});

describe('DeepSeekTransport', () => {
  it('把 DeepSeek 的 delta 映射为 AgentEvent 流', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          'data: {"choices":[{"delta":{"reasoning_content":"想一想"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"！"},"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const transport = new DeepSeekTransport({ baseUrl: 'https://api.deepseek.com/' });
    const events: AgentEvent[] = [];
    for await (const event of transport.stream(createRequest())) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'run.start', messageId: 'msg_1', runId: expect.stringMatching(/^deepseek_/) },
      { type: 'reasoning.delta', messageId: 'msg_1', text: '想一想' },
      { type: 'text.delta', messageId: 'msg_1', text: '你好' },
      { type: 'text.delta', messageId: 'msg_1', text: '！' },
      { type: 'run.end', messageId: 'msg_1', finishReason: 'stop' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('工具调用会执行本地工具并把结果回传给模型', async () => {
    const toolRound = [
      {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'calculator', arguments: '{"expression":' },
                },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, function: { arguments: '"6*7"}' } }],
            },
          },
        ],
      },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    ];
    const finalRound = [
      { choices: [{ delta: { content: '答案是 42。' } }] },
      { choices: [{ delta: {}, finish_reason: 'stop' }] },
    ];
    const toSse = (frames: unknown[]) =>
      frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join('') + 'data: [DONE]\n\n';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sseResponse([toSse(toolRound)]))
      .mockResolvedValueOnce(sseResponse([toSse(finalRound)]));
    vi.stubGlobal('fetch', fetchMock);

    const transport = new DeepSeekTransport({ baseUrl: 'https://api.deepseek.com' });
    const events: AgentEvent[] = [];
    for await (const event of transport.stream(createRequest())) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'run.start', messageId: 'msg_1', runId: expect.stringMatching(/^deepseek_/) },
      {
        type: 'tool.start',
        messageId: 'msg_1',
        toolCallId: 'call_1',
        name: 'calculator',
        args: { expression: '6*7' },
      },
      {
        type: 'tool.end',
        messageId: 'msg_1',
        toolCallId: 'call_1',
        status: 'success',
        result: '6*7 = 42',
      },
      { type: 'text.delta', messageId: 'msg_1', text: '答案是 42。' },
      { type: 'run.end', messageId: 'msg_1', finishReason: 'stop' },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    const secondBody = JSON.parse(String(secondInit?.body)) as {
      messages: Array<Record<string, unknown>>;
      tools: unknown[];
    };

    expect(secondBody.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          tool_calls: [expect.objectContaining({ id: 'call_1' })],
        }),
        { role: 'tool', tool_call_id: 'call_1', content: '6*7 = 42' },
      ]),
    );
    expect(secondBody.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'function',
          function: expect.objectContaining({ name: 'calculator' }),
        }),
      ]),
    );
  });

  it('把 HTTP 错误转换为可读异常', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { message: 'invalid api key' } }), { status: 401 }),
        ),
    );

    const transport = new DeepSeekTransport({ baseUrl: 'https://api.deepseek.com' });
    const collect = async () => {
      for await (const event of transport.stream(createRequest())) {
        if (event.type === 'run.end') break;
      }
    };

    await expect(collect()).rejects.toThrow('HTTP 401 - invalid api key');
  });
});
