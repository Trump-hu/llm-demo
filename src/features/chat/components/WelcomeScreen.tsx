import {
  BarChartOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { Suggestion } from '../constants';
import { SUGGESTIONS } from '../constants';

const ICONS = {
  code: <CodeOutlined />,
  agent: <DeploymentUnitOutlined />,
  deck: <FileTextOutlined />,
  chart: <BarChartOutlined />,
} as const;

interface WelcomeScreenProps {
  onPick: (prompt: string) => void;
}

export function WelcomeScreen({ onPick }: WelcomeScreenProps) {
  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-badge">
          <span className="pulse-dot" />
          Agent 运行时已就绪 · 支持工具编排与流式推理
        </div>

        <h1 className="welcome-title">
          你好，我是 T-HU
          <br />
          今天想构建什么？
        </h1>
        <p className="welcome-subtitle">
          我可以拆解复杂任务、调用工具、实时推理并输出结构化结果。选择下面的场景快速开始，或直接输入你的问题。
        </p>

        <div className="suggestion-grid">
          {SUGGESTIONS.map((item: Suggestion) => (
            <button
              key={item.key}
              type="button"
              className="suggestion-card"
              onClick={() => onPick(item.prompt)}
            >
              <span className="suggestion-icon">{ICONS[item.icon]}</span>
              <span>
                <span className="suggestion-title">{item.title}</span>
                <span className="suggestion-desc">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
