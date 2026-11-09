export interface ModelOption {
  value: string;
  label: string;
  description: string;
  badge?: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    value: 'nexus-1.5-pro',
    label: 'Nexus 1.5 Pro',
    description: '复杂推理与工具编排，适合构建 Agent 工作流',
    badge: '推荐',
  },
  {
    value: 'nexus-1.5-flash',
    label: 'Nexus 1.5 Flash',
    description: '低延迟，适合高频对话与轻量任务',
  },
  {
    value: 'nexus-coder',
    label: 'Nexus Coder',
    description: '面向代码生成、重构与调试',
  },
];

export const DEFAULT_MODEL = MODEL_OPTIONS[0]!.value;

export interface Suggestion {
  key: string;
  icon: 'code' | 'agent' | 'deck' | 'chart';
  title: string;
  description: string;
  prompt: string;
}

export const SUGGESTIONS: Suggestion[] = [
  {
    key: 'agent',
    icon: 'agent',
    title: '设计一个 Agent 工作流',
    description: '把任务拆解为可执行步骤，并编排工具调用',
    prompt: '帮我设计一个能够自动检索资料并生成周报的 Agent 工作流',
  },
  {
    key: 'code',
    icon: 'code',
    title: '生成组件代码',
    description: '基于 React + TypeScript 的完整实现',
    prompt: '用 React + TypeScript 写一个支持流式输出的聊天气泡组件',
  },
  {
    key: 'deck',
    icon: 'deck',
    title: '整理技术方案',
    description: '输出结构化的架构说明与取舍分析',
    prompt: '整理一份 AI Agent 前端工程化的技术方案，包含分层与目录约定',
  },
  {
    key: 'chart',
    icon: 'chart',
    title: '分析数据洞察',
    description: '从数据中提炼结论与下一步动作',
    prompt: '分析一份对话系统的埋点数据，给出优化留存的关键指标',
  },
];

export const TOOL_LABELS: Record<string, string> = {
  web_search: '联网搜索',
  fetch_page: '读取网页',
  workspace_search: '检索工作区',
  code_interpreter: '代码执行',
  calculator: '计算器',
};
