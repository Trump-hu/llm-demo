type Token = { kind: 'number'; value: number } | { kind: 'operator'; value: string };

const OPERATORS = new Set(['+', '-', '*', '/', '%', '^', '(', ')']);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index]!;
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (OPERATORS.has(char)) {
      tokens.push({ kind: 'operator', value: char });
      index += 1;
      continue;
    }
    const match = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(input.slice(index));
    if (!match) {
      throw new Error(`无法识别的字符：${char}`);
    }
    tokens.push({ kind: 'number', value: Number(match[0]) });
    index += match[0].length;
  }

  return tokens;
}

/** 安全的四则运算表达式求值，不依赖 eval / Function */
export function evaluateExpression(expression: string): number {
  const tokens = tokenize(expression);
  let cursor = 0;

  const peek = (): Token | undefined => tokens[cursor];

  const consumeOperator = (value: string): boolean => {
    const token = peek();
    if (token?.kind === 'operator' && token.value === value) {
      cursor += 1;
      return true;
    }
    return false;
  };

  const parseExpression = (): number => {
    let value = parseTerm();
    for (;;) {
      if (consumeOperator('+')) value += parseTerm();
      else if (consumeOperator('-')) value -= parseTerm();
      else return value;
    }
  };

  const parseTerm = (): number => {
    let value = parseUnary();
    for (;;) {
      if (consumeOperator('*')) {
        value *= parseUnary();
      } else if (consumeOperator('/')) {
        const divisor = parseUnary();
        if (divisor === 0) throw new Error('除数不能为 0');
        value /= divisor;
      } else if (consumeOperator('%')) {
        const divisor = parseUnary();
        if (divisor === 0) throw new Error('除数不能为 0');
        value %= divisor;
      } else {
        return value;
      }
    }
  };

  const parseUnary = (): number => {
    if (consumeOperator('+')) return parseUnary();
    if (consumeOperator('-')) return -parseUnary();
    return parsePower();
  };

  const parsePower = (): number => {
    const base = parsePrimary();
    return consumeOperator('^') ? base ** parseUnary() : base;
  };

  const parsePrimary = (): number => {
    const token = peek();
    if (!token) throw new Error('表达式不完整');
    if (token.kind === 'number') {
      cursor += 1;
      return token.value;
    }
    if (token.value === '(') {
      cursor += 1;
      const value = parseExpression();
      if (!consumeOperator(')')) throw new Error('缺少右括号');
      return value;
    }
    throw new Error(`意外的符号：${token.value}`);
  };

  const result = parseExpression();
  const remaining = peek();
  if (remaining) {
    throw new Error(`表达式存在多余内容：${remaining.value}`);
  }
  if (!Number.isFinite(result)) {
    throw new Error('计算结果不是有限数值');
  }
  return result;
}
