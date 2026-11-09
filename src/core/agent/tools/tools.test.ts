import { describe, expect, it } from 'vitest';
import { evaluateExpression } from './calculator';
import { executeTool } from './index';

describe('evaluateExpression', () => {
  it('按优先级计算四则运算与括号', () => {
    expect(evaluateExpression('1 + 2 * 3')).toBe(7);
    expect(evaluateExpression('(1 + 2) * 3')).toBe(9);
    expect(evaluateExpression('2 ^ 3 ^ 2')).toBe(512);
    expect(evaluateExpression('-2^2')).toBe(-4);
    expect(evaluateExpression('7 % 4')).toBe(3);
  });

  it('拒绝除零与非法字符', () => {
    expect(() => evaluateExpression('1 / 0')).toThrow('除数不能为 0');
    expect(() => evaluateExpression('1 + a')).toThrow('无法识别的字符');
    expect(() => evaluateExpression('(1 + 2')).toThrow('缺少右括号');
  });
});

describe('executeTool', () => {
  it('执行 calculator', async () => {
    await expect(executeTool('calculator', { expression: '6*7' })).resolves.toBe('6*7 = 42');
  });

  it('未知工具会抛错', async () => {
    await expect(executeTool('nope', {})).rejects.toThrow('未知工具');
  });
});
