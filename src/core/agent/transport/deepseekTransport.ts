import { TOOL_DEFINITIONS, executeTool } from '../tools';
import type { AgentEvent, ChatRequest } from '../types';
import type { ChatTransport } from './ChatTransport';

interface DeepSeekTransportOptions {
  /** API 根地址：直连用 https://api.deepseek.com，走 Vite 代理用 /deepseek */
  baseUrl: string;
  /** 浏览器直连时需要；走开发代理时留空，由代理注入 Authorization */
  apiKey?: string;
  /** settings.model 不是 deepseek-* 时使用的兜底模型 */
  defaultModel?: string;
}

export interface DeepSeekToolCallDelta {
  index?: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface DeepSeekDelta {
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: DeepSeekToolCallDelta[];
}

export interface DeepSeekChunk {
  choices?: Array<{
    delta?: DeepSeekDelta;
    finish_reason?: string | null;
  }>;
  error?: { message?: string };
}

export interface DeepSeekToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

type DeepSeekMessage =
  | { role: 'system' | 'user'; content: string }
  | {
      role: 'assistant';
      content: string | null;
      reasoning_content?: string;
      tool_calls?: DeepSeekToolCall[];
    }
  | { role: 'tool'; tool_call_id: string; content: string };

interface ToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

interface RoundResult {
  finishReason: string | null;
  text: string;
  reasoning: string;
  toolCalls: DeepSeekToolCall[];
}

const MAX_TOOL_ROUNDS = 5;

export interface ParsedDeepSeekSse {
  chunks: DeepSeekChunk[];
  rest: string;
  done: boolean;
}

/**
 * 解析 OpenAI 兼容的 SSE 文本块。
 * 返回已完成的 chunk、尚未收尾的残帧，以及是否收到 `[DONE]`。
 */
export function parseDeepSeekSse(buffer: string): ParsedDeepSeekSse {
  const frames = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = frames.pop() ?? '';
  const chunks: DeepSeekChunk[] = [];
  let done = false;

  for (const frame of frames) {
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');
    if (!data) continue;
    if (data === '[DONE]') {
      done = true;
      continue;
    }
    try {
      chunks.push(JSON.parse(data) as DeepSeekChunk);
    } catch {
      // 忽略无法解析的帧，避免单帧脏数据中断整个流
    }
  }

  return { chunks, rest, done };
}

async function readHttpError(response: Response): Promise<string> {
  let detail = '';
  try {
    const text = await response.text();
    if (text) {
      try {
        const payload = JSON.parse(text) as { error?: { message?: string } };
        detail = payload.error?.message ?? text.slice(0, 200);
      } catch {
        detail = text.slice(0, 200);
      }
    }
  } catch {
    // 读取响应体失败时只保留状态码
  }
  return `DeepSeek API 请求失败：HTTP ${response.status}${detail ? ` - ${detail}` : ''}`;
}

export function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('工具参数必须是 JSON 对象');
  }
  return parsed as Record<string, unknown>;
}

function toToolCalls(accumulated: Map<number, ToolCallAccumulator>): DeepSeekToolCall[] {
  return [...accumulated.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, call]) => call)
    .filter((call) => call.name.length > 0)
    .map((call) => ({
      id: call.id || `call_${Math.random().toString(36).slice(2, 10)}`,
      type: 'function' as const,
      function: {
        name: call.name,
        arguments: call.arguments || '{}',
      },
    }));
}

/**
 * DeepSeek 官方 API（OpenAI 兼容）传输层。
 * 把流式 delta 映射为 AgentEvent；遇到 `finish_reason: tool_calls` 时执行本地工具，
 * 追加 assistant/tool 消息后继续请求，直到模型给出最终回答。
 */
export class DeepSeekTransport implements ChatTransport {
  readonly id = 'deepseek';
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly defaultModel: string;

  constructor({ baseUrl, apiKey, defaultModel }: DeepSeekTransportOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.defaultModel = defaultModel?.trim() || 'deepseek-chat';
  }

  private resolveModel(model: string): string {
    return model.startsWith('deepseek-') ? model : this.defaultModel;
  }

  async *stream(request: ChatRequest): AsyncGenerator<AgentEvent> {
    const { messageId, signal } = request;
    const model = this.resolveModel(request.settings.model);
    const messages: DeepSeekMessage[] = request.messages.map((message) => {
      if (message.role === 'assistant') {
        return {
          role: 'assistant',
          content: message.content || null,
          ...(message.reasoningContent ? { reasoning_content: message.reasoningContent } : {}),
        };
      }
      return { role: message.role, content: message.content };
    });

    yield { type: 'run.start', messageId, runId: `deepseek_${Date.now().toString(36)}` };

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          tools: TOOL_DEFINITIONS,
          tool_choice: 'auto',
        }),
        signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(await readHttpError(response));
      }

      const result = yield* this.readRound(response.body, messageId);

      if (result.finishReason !== 'tool_calls' || result.toolCalls.length === 0) {
        yield { type: 'run.end', messageId, finishReason: result.finishReason ?? 'stop' };
        return;
      }

      messages.push({
        role: 'assistant',
        content: result.text || null,
        ...(result.reasoning ? { reasoning_content: result.reasoning } : {}),
        tool_calls: result.toolCalls,
      });

      for (const call of result.toolCalls) {
        let args: Record<string, unknown> = {};
        let parseError: string | null = null;

        try {
          args = parseToolArguments(call.function.arguments);
        } catch (error) {
          parseError = error instanceof Error ? error.message : '工具参数解析失败';
        }

        yield {
          type: 'tool.start',
          messageId,
          toolCallId: call.id,
          name: call.function.name,
          args: parseError ? call.function.arguments : args,
        };

        let status: 'success' | 'error' = 'success';
        let output: string;

        if (parseError) {
          status = 'error';
          output = `工具参数解析失败：${parseError}`;
        } else {
          try {
            output = await executeTool(call.function.name, args);
          } catch (error) {
            status = 'error';
            output = error instanceof Error ? error.message : '工具执行失败';
          }
        }

        yield { type: 'tool.end', messageId, toolCallId: call.id, status, result: output };
        messages.push({ role: 'tool', tool_call_id: call.id, content: output });
      }
    }

    yield { type: 'run.end', messageId, finishReason: 'max_tool_rounds' };
  }

  private async *readRound(
    body: NonNullable<Response['body']>,
    messageId: string,
  ): AsyncGenerator<AgentEvent, RoundResult> {
    const reader = body.pipeThrough(new TextDecoderStream()).getReader();
    const accumulated = new Map<number, ToolCallAccumulator>();
    let buffer = '';
    let text = '';
    let reasoning = '';
    let finishReason: string | null = null;
    let streamDone = false;

    try {
      while (!streamDone && !finishReason) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += value;
        const parsed = parseDeepSeekSse(buffer);
        buffer = parsed.rest;
        streamDone = parsed.done;

        for (const chunk of parsed.chunks) {
          if (chunk.error?.message) {
            throw new Error(`DeepSeek API 错误：${chunk.error.message}`);
          }

          const choice = chunk.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;

          const reasoningDelta = delta?.reasoning_content;
          if (reasoningDelta) {
            reasoning += reasoningDelta;
            yield { type: 'reasoning.delta', messageId, text: reasoningDelta };
          }

          const content = delta?.content;
          if (content) {
            text += content;
            yield { type: 'text.delta', messageId, text: content };
          }

          const toolCalls = delta?.tool_calls ?? [];
          for (const [position, call] of toolCalls.entries()) {
            const index = call.index ?? position;
            const current = accumulated.get(index) ?? { id: '', name: '', arguments: '' };
            if (call.id) current.id = call.id;
            if (call.function?.name) current.name = call.function.name;
            if (call.function?.arguments) current.arguments += call.function.arguments;
            accumulated.set(index, current);
          }

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
            break;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      finishReason,
      text,
      reasoning,
      toolCalls: finishReason === 'tool_calls' ? toToolCalls(accumulated) : [],
    };
  }
}
