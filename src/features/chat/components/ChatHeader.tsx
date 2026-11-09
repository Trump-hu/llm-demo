import { Button, Dropdown, Tooltip } from 'antd';
import {
  CheckOutlined,
  DownOutlined,
  MenuOutlined,
  SettingOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ChatSettings } from '@/core/agent/types';
import { MODEL_OPTIONS } from '../constants';

interface ChatHeaderProps {
  title: string;
  settings: ChatSettings;
  onSettingsChange: (patch: Partial<ChatSettings>) => void;
  onOpenSidebar: () => void;
}

export function ChatHeader({ title, settings, onSettingsChange, onOpenSidebar }: ChatHeaderProps) {
  const current = MODEL_OPTIONS.find((item) => item.value === settings.model) ?? MODEL_OPTIONS[0]!;

  const items: MenuProps['items'] = MODEL_OPTIONS.map((option) => ({
    key: option.value,
    label: (
      <div style={{ minWidth: 240, padding: '2px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 600,
            color: '#e9f0fb',
          }}
        >
          {option.label}
          {option.badge && (
            <span
              style={{
                fontSize: 10,
                padding: '0 6px',
                borderRadius: 4,
                color: '#05070c',
                background: 'linear-gradient(135deg,#22d3ee,#8b5cf6)',
              }}
            >
              {option.badge}
            </span>
          )}
          {option.value === settings.model && (
            <CheckOutlined style={{ marginLeft: 'auto', color: '#22d3ee' }} />
          )}
        </div>
        <div style={{ fontSize: 11.5, color: '#6f7f96', lineHeight: 1.5 }}>
          {option.description}
        </div>
      </div>
    ),
  }));

  return (
    <header className="chat-header">
      <div className="header-left">
        <Button
          className="sidebar-toggle icon-btn"
          type="text"
          icon={<MenuOutlined />}
          onClick={onOpenSidebar}
          aria-label="打开会话列表"
        />
        <Dropdown
          menu={{ items, onClick: ({ key }) => onSettingsChange({ model: key }) }}
          trigger={['click']}
          placement="bottomLeft"
        >
          <Button className="model-trigger">
            <span className="model-dot" />
            {current.label}
            <DownOutlined style={{ fontSize: 10, opacity: 0.6 }} />
          </Button>
        </Dropdown>
        <span className="header-title">{title}</span>
      </div>

      <div className="header-right">
        <Tooltip title="分享对话（即将支持）">
          <Button className="icon-btn" type="text" icon={<ShareAltOutlined />} />
        </Tooltip>
        <Tooltip title="设置（即将支持）">
          <Button className="icon-btn" type="text" icon={<SettingOutlined />} />
        </Tooltip>
      </div>
    </header>
  );
}
