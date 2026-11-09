import { useEffect, useState } from 'react';
import {
  ApiOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  DownOutlined,
  LoadingOutlined,
  UpOutlined,
} from '@ant-design/icons';
import type { ToolCallPart } from '@/core/agent/types';
import { TOOL_LABELS } from '../constants';
import { formatDuration } from '@/shared/utils/format';

interface ToolCallCardProps {
  part: ToolCallPart;
}

function stringify(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** 工具调用卡片：展示 Agent 的工具名、入参、耗时与结果 */
export function ToolCallCard({ part }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(part.status === 'running');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (part.status !== 'running') return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [part.status]);

  const elapsed = (part.finishedAt ?? now) - part.startedAt;
  const hasBody = part.args !== undefined || part.result !== undefined;

  return (
    <div className="tool-card">
      <button
        type="button"
        className="tool-header"
        onClick={() => hasBody && setExpanded((value) => !value)}
      >
        <ApiOutlined style={{ color: '#7dd3fc' }} />
        <span>
          {TOOL_LABELS[part.name] ?? '调用工具'}
          <span className="tool-name"> · {part.name}</span>
        </span>
        <span
          className={`tool-status ${
            part.status === 'success' ? 'is-success' : part.status === 'error' ? 'is-error' : ''
          }`}
        >
          {part.status === 'running' && (
            <>
              <LoadingOutlined /> 执行中 {formatDuration(elapsed)}
            </>
          )}
          {part.status === 'success' && (
            <>
              <CheckCircleFilled /> {formatDuration(elapsed)}
            </>
          )}
          {part.status === 'error' && (
            <>
              <CloseCircleFilled /> 失败
            </>
          )}
        </span>
        {hasBody &&
          (expanded ? (
            <UpOutlined style={{ fontSize: 10 }} />
          ) : (
            <DownOutlined style={{ fontSize: 10 }} />
          ))}
      </button>

      {expanded && hasBody && (
        <div className="tool-body">
          {part.args !== undefined && (
            <div>
              <div className="tool-block-label">入参</div>
              <div className="tool-block">{stringify(part.args)}</div>
            </div>
          )}
          {part.result !== undefined && (
            <div>
              <div className="tool-block-label">结果</div>
              <div className="tool-block">{part.result}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
