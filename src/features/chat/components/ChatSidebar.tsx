import { useMemo, useState } from 'react';
import { App, Avatar, Button, Drawer, Dropdown, Input, Modal, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  MessageOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';
import type { Conversation } from '@/core/agent/types';
import { formatRelativeTime } from '@/shared/utils/format';
import { useChatStore } from '../store/chatStore';

interface ChatSidebarProps {
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDismiss?: () => void;
}

function groupConversations(list: Conversation[]): Array<[string, Conversation[]]> {
  const now = Date.now();
  const day = 86_400_000;
  const groups: Record<string, Conversation[]> = {
    今天: [],
    '最近 7 天': [],
    更早: [],
  };

  for (const item of list) {
    const age = now - item.updatedAt;
    if (age < day) groups['今天']!.push(item);
    else if (age < day * 7) groups['最近 7 天']!.push(item);
    else groups['更早']!.push(item);
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

export function ChatSidebar({ onSelectConversation, onNewChat, onDismiss }: ChatSidebarProps) {
  const { modal, message } = App.useApp();
  const conversations = useChatStore((state) => state.conversations);
  const order = useChatStore((state) => state.order);
  const activeId = useChatStore((state) => state.activeId);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const renameConversation = useChatStore((state) => state.renameConversation);

  const [keyword, setKeyword] = useState('');
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const list = useMemo(
    () =>
      order
        .map((id) => conversations[id])
        .filter((item): item is Conversation => Boolean(item))
        .filter((item) => item.title.toLowerCase().includes(keyword.trim().toLowerCase())),
    [order, conversations, keyword],
  );

  const groups = useMemo(() => groupConversations(list), [list]);

  const handleDelete = (conversation: Conversation) => {
    modal.confirm({
      title: '删除该对话？',
      content: `「${conversation.title}」的聊天记录将被永久删除。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        deleteConversation(conversation.id);
        message.success('对话已删除');
      },
    });
  };

  const handleRename = () => {
    if (!renaming) return;
    renameConversation(renaming.id, renameValue);
    setRenaming(null);
  };

  const menuFor = (conversation: Conversation): MenuProps['items'] => [
    {
      key: 'rename',
      icon: <EditOutlined />,
      label: '重命名',
      onClick: () => {
        setRenaming(conversation);
        setRenameValue(conversation.title);
      },
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: () => handleDelete(conversation),
    },
  ];

  return (
    <>
      <div className="brand">
        <div className="brand-mark">
          <ThunderboltFilled />
        </div>
        <div className="brand-text">
          <span className="brand-name">T-HU</span>
          <span className="brand-sub">Agent Console</span>
        </div>
      </div>

      <Button
        className="new-chat-btn"
        icon={<PlusOutlined />}
        block
        onClick={() => {
          onNewChat();
          onDismiss?.();
        }}
      >
        新建对话
      </Button>

      <Input
        className="sidebar-search"
        prefix={<SearchOutlined style={{ color: '#6f7f96' }} />}
        placeholder="搜索会话"
        allowClear
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />

      <div className="conv-list">
        {groups.length === 0 && (
          <div className="conv-group-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
            {keyword ? '没有匹配的会话' : '暂无会话，开始你的第一次对话吧'}
          </div>
        )}

        {groups.map(([label, items]) => (
          <div key={label}>
            <div className="conv-group-label">{label}</div>
            {items.map((conversation) => (
              <div
                key={conversation.id}
                className={`conv-item ${conversation.id === activeId ? 'is-active' : ''}`}
                onClick={() => {
                  onSelectConversation(conversation.id);
                  onDismiss?.();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onSelectConversation(conversation.id);
                    onDismiss?.();
                  }
                }}
              >
                <MessageOutlined className="conv-icon" />
                <div className="conv-main">
                  <div className="conv-title">{conversation.title}</div>
                  <div className="conv-meta">{formatRelativeTime(conversation.updatedAt)}</div>
                </div>
                <Dropdown menu={{ items: menuFor(conversation) }} trigger={['click']}>
                  <Button
                    className="conv-more"
                    type="text"
                    size="small"
                    icon={<MoreOutlined />}
                    onClick={(event) => event.stopPropagation()}
                  />
                </Dropdown>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="quota-card">
          <div className="quota-head">
            <span>本月 Token 额度</span>
            <span style={{ color: '#a9b8cf' }}>68%</span>
          </div>
          <div className="quota-bar">
            <i style={{ width: '68%' }} />
          </div>
        </div>

        <Tooltip title="账户中心（即将支持）" placement="right">
          <div className="user-card">
            <Avatar
              size={30}
              style={{
                background: 'linear-gradient(135deg,#22d3ee,#8b5cf6)',
                color: '#05070c',
                fontWeight: 700,
              }}
            >
              N
            </Avatar>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="user-name">T-HU 开发者</div>
              <div className="user-plan">Pro 工作区 · 已连接</div>
            </div>
          </div>
        </Tooltip>
      </div>

      <Modal
        title="重命名对话"
        open={Boolean(renaming)}
        onOk={handleRename}
        onCancel={() => setRenaming(null)}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Input
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          onPressEnter={handleRename}
          maxLength={40}
          autoFocus
        />
      </Modal>
    </>
  );
}

interface ChatSidebarDrawerProps extends ChatSidebarProps {
  open: boolean;
}

export function ChatSidebarDrawer({ open, onDismiss, ...rest }: ChatSidebarDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onDismiss}
      placement="left"
      size={280}
      closable={false}
      styles={{
        body: { padding: '18px 12px 12px', display: 'flex', flexDirection: 'column', gap: 14 },
      }}
    >
      <ChatSidebar {...rest} onDismiss={onDismiss} />
    </Drawer>
  );
}
