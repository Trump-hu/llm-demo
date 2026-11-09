import type { AgentEvent, ChatRequest } from '../types';
import type { ChatTransport } from './ChatTransport';

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** 让文本看起来像逐字生成：中英文都按小片段切分 */
function* chunkText(text: string, size = 2): Generator<string> {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
  }
}

const DEMO_REASONING = `先拆解需求：用户想要一个具备 Agent 能力的对话界面。

1. 明确渲染边界 —— 推理、工具调用、正文需要能交错出现，因此消息采用 parts 结构。
2. 状态管理 —— 流式增量只更新最后一条助手消息，避免整棵树重渲染。
3. 扩展性 —— 传输层抽象为事件流，后端换成真实 LLM 时渲染层零改动。

接着核对工程约束：TypeScript 严格模式、路径别名、Ant Design 主题令牌统一收口。`;

function buildAnswer(prompt: string): string {
  return `收到，下面是我对「${prompt.slice(0, 18)}${prompt.length > 18 ? '…' : ''}」的完整方案 👇

### 一、分层设计

| 层级 | 职责 | 目录 |
| --- | --- | --- |
| 表现层 | 页面、组件、交互 | \`src/features\` |
| 领域层 | 消息模型、事件 reducer、传输层 | \`src/core/agent\` |
| 共享层 | 主题、工具函数、通用组件 | \`src/shared\` |

### 二、事件流协议

后端只需按约定推送 SSE 帧，前端即可还原完整的 Agent 轨迹：

\`\`\`ts
type AgentEvent =
  | { type: 'text.delta'; messageId: string; text: string }
  | { type: 'reasoning.delta'; messageId: string; text: string }
  | { type: 'tool.start'; messageId: string; toolCallId: string; name: string }
  | { type: 'run.end'; messageId: string; finishReason?: string };
\`\`\`

### 三、下一步

1. 在 \`core/agent/transport\` 新增 WebSocket 实现，用于双向中断；
2. 引入 \`zod\` 校验服务端事件，避免脏数据击穿 UI；
3. 用虚拟滚动承载超长会话。

> 以上结构已经就绪，直接替换传输层即可接入真实模型。`;
}

function buildToolPlan(request: ChatRequest) {
  if (request.settings.webSearch) {
    return [
      {
        name: 'web_search',
        args: { query: 'AI agent ui architecture best practice' },
        result: '返回 3 条结果：Agent 前端分层、事件流协议设计、可折叠推理面板。',
      },
      {
        name: 'fetch_page',
        args: { url: 'https://example.com/agent-ui' },
        result: '已抓取正文 2.4KB，提取出 4 个关键论点。',
      },
    ];
  }
  return [
    {
      name: 'workspace_search',
      args: { pattern: 'src/core/agent/**' },
      result: '命中 6 个文件：types.ts、eventReducer.ts、transport/*。',
    },
  ];
}

/**
 * 内置 Mock 传输层：无需后端即可完整演示流式推理 + 工具调用。
 */
export class MockTransport implements ChatTransport {
  readonly id = 'mock';

  async *stream(request: ChatRequest): AsyncGenerator<AgentEvent> {
    const { messageId, signal } = request;
    const runId = `run_${Date.now().toString(36)}`;
    const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');

    yield { type: 'run.start', messageId, runId };
    await sleep(220, signal);

    if (request.settings.deepThink) {
      for (const chunk of chunkText(DEMO_REASONING, 4)) {
        yield { type: 'reasoning.delta', messageId, text: chunk };
        await sleep(9, signal);
      }
      await sleep(180, signal);
    }

    for (const tool of buildToolPlan(request)) {
      const toolCallId = `call_${Math.random().toString(36).slice(2, 8)}`;
      yield { type: 'tool.start', messageId, toolCallId, name: tool.name, args: tool.args };
      await sleep(680, signal);
      yield {
        type: 'tool.end',
        messageId,
        toolCallId,
        status: 'success',
        result: tool.result,
      };
      await sleep(160, signal);
    }

    const answer = buildAnswer(lastUser?.content ?? '你的问题');
    for (const chunk of chunkText(answer, 3)) {
      yield { type: 'text.delta', messageId, text: chunk };
      await sleep(12, signal);
    }

    yield { type: 'run.end', messageId, finishReason: 'stop' };
  }
}
