import { useState, type KeyboardEvent } from 'react';
import { Input, Tooltip } from 'antd';
import {
  ArrowUpOutlined,
  BulbOutlined,
  GlobalOutlined,
  PaperClipOutlined,
  PauseOutlined,
} from '@ant-design/icons';
import type { ChatSettings } from '@/core/agent/types';

const MAX_LENGTH = 4000;

interface ComposerProps {
  streaming: boolean;
  settings: ChatSettings;
  onSettingsChange: (patch: Partial<ChatSettings>) => void;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ streaming, settings, onSettingsChange, onSend, onStop }: ComposerProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    setValue('');
    onSend(text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <Input.TextArea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="给 T-HU 发送消息，或在 / 后调用工具…"
          autoSize={{ minRows: 1, maxRows: 8 }}
          maxLength={MAX_LENGTH}
          variant="borderless"
          aria-label="消息输入框"
        />

        <div className="composer-toolbar">
          <div className="composer-tools">
            <Tooltip title="上传文件（即将支持）">
              <span className="chip" aria-disabled>
                <PaperClipOutlined />
                附件
              </span>
            </Tooltip>
            <button
              type="button"
              className={`chip is-violet ${settings.deepThink ? 'is-on' : ''}`}
              onClick={() => onSettingsChange({ deepThink: !settings.deepThink })}
              aria-pressed={settings.deepThink}
            >
              <BulbOutlined />
              深度思考
            </button>
            <button
              type="button"
              className={`chip ${settings.webSearch ? 'is-on' : ''}`}
              onClick={() => onSettingsChange({ webSearch: !settings.webSearch })}
              aria-pressed={settings.webSearch}
            >
              <GlobalOutlined />
              联网搜索
            </button>
          </div>

          {streaming ? (
            <button
              type="button"
              className="send-btn is-stop"
              onClick={onStop}
              aria-label="停止生成"
            >
              <PauseOutlined />
            </button>
          ) : (
            <button
              type="button"
              className="send-btn"
              onClick={submit}
              disabled={!value.trim()}
              aria-label="发送"
            >
              <ArrowUpOutlined />
            </button>
          )}
        </div>
      </div>

      <div className="composer-hint">
        Enter 发送 · Shift + Enter 换行 · 内容由 AI 生成，请自行甄别
      </div>
    </div>
  );
}
