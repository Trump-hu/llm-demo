import { useEffect, useRef, useState } from 'react';
import { BulbOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';

interface ThinkingPanelProps {
  text: string;
  streaming: boolean;
}

/** 深度思考面板：运行中默认展开并计时，结束后默认收起（用户手动切换后以其选择为准） */
export function ThinkingPanel({ text, streaming }: ThinkingPanelProps) {
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef(0);

  const expanded = userToggled ?? streaming;

  useEffect(() => {
    if (!streaming) return;
    startedAtRef.current = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [streaming]);

  return (
    <div className="thinking">
      <button
        type="button"
        className="thinking-header"
        onClick={() => setUserToggled(!expanded)}
        aria-expanded={expanded}
      >
        {streaming ? <span className="thinking-dot" /> : <BulbOutlined />}
        <span className="thinking-title">
          {streaming ? `正在深度思考… ${elapsed}s` : '深度思考过程'}
        </span>
        {expanded ? (
          <UpOutlined style={{ fontSize: 10 }} />
        ) : (
          <DownOutlined style={{ fontSize: 10 }} />
        )}
      </button>
      {expanded && <div className="thinking-body">{text || '正在分析问题…'}</div>}
    </div>
  );
}
