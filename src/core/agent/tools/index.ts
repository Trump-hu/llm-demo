import { evaluateExpression } from './calculator';
import { isValidIdCard } from './validator';

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, Record<string, unknown>>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  execute: (args: Record<string, unknown>) => string | Promise<string>;
}

function readString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : '';
}

const calculatorTool: ToolDefinition = {
  name: 'calculator',
  description: '计算数学表达式，支持 + - * / % ^、括号和小数',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: '要计算的表达式，例如 (1 + 2) * 3',
      },
    },
    required: ['expression'],
    additionalProperties: false,
  },
  execute: (args) => {
    const expression = readString(args, 'expression');
    if (!expression) throw new Error('缺少 expression 参数');
    return `${expression} = ${evaluateExpression(expression)}`;
  },
};

const currentTimeTool: ToolDefinition = {
  name: 'get_current_time',
  description: '获取当前日期与时间，可指定 IANA 时区（例如 Asia/Shanghai）',
  parameters: {
    type: 'object',
    properties: {
      timeZone: {
        type: 'string',
        description: 'IANA 时区名称；不传则使用本地时区',
      },
    },
    additionalProperties: false,
  },
  execute: (args) => {
    const requested = readString(args, 'timeZone');
    const timeZone = requested || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const formatted = new Intl.DateTimeFormat('zh-CN', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone,
    }).format(now);
    return `${formatted}（时区：${timeZone}，ISO：${now.toISOString()}）`;
  },
};

const validatorTool: ToolDefinition = {
  name: 'validator',
  description: '验证身份证号码是否合法',
  parameters: {
    type: 'object',
    properties: {
      idCard: {
        type: 'string',
        description: '要验证的身份证号码',
      },
    },
    required: ['isValidIdCard'],
    additionalProperties: false,
  },
  execute: (args) => {
    const idCard = readString(args, 'isValidIdCard');
    if (!idCard) throw new Error('缺少 idCard 参数');
    return `身份证号码 ${idCard} ${isValidIdCard(idCard) ? '合法' : '不合法'}`;
  },
};

export const BUILTIN_TOOLS: ToolDefinition[] = [calculatorTool, currentTimeTool,validatorTool];

/** OpenAI / DeepSeek 兼容的 tools 参数 */
export const TOOL_DEFINITIONS = BUILTIN_TOOLS.map((tool) => ({
  type: 'function' as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const tool = BUILTIN_TOOLS.find((item) => item.name === name);
  if (!tool) throw new Error(`未知工具：${name}`);
  return await tool.execute(args);
}
