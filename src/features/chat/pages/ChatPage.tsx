import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ChatMessage } from '@/core/agent/types';
import { useAutoScroll } from '@/shared/hooks/useAutoScroll';
import { ChatHeader } from '../components/ChatHeader';
import { ChatSidebar, ChatSidebarDrawer } from '../components/ChatSidebar';
import { Composer } from '../components/Composer';
import { MessageList } from '../components/MessageList';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { useAgentRun } from '../hooks/useAgentRun';
import { selectActiveConversation, useChatStore } from '../store/chatStore';

const EMPTY_MESSAGES: ChatMessage[] = [];

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();

  const conversation = useChatStore(selectActiveConversation);
  const activeId = useChatStore((state) => state.activeId);
  const streaming = useChatStore((state) => state.streaming);
  const settings = useChatStore((state) => state.settings);
  const updateSettings = useChatStore((state) => state.updateSettings);
  const selectConversation = useChatStore((state) => state.selectConversation);
  const createConversation = useChatStore((state) => state.createConversation);

  const { send, stop, regenerate } = useAgentRun();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const messages = conversation?.messages ?? EMPTY_MESSAGES;
  const streamingMessageId =
    streaming && streaming.conversationId === conversation?.id ? streaming.messageId : null;
  const scrollRef = useAutoScroll<HTMLDivElement>([messages, streamingMessageId], {
    threshold: 140,
  });

  // 路由 → store：支持通过 URL 直接打开某个会话
  useEffect(() => {
    if (conversationId && useChatStore.getState().activeId !== conversationId) {
      selectConversation(conversationId);
    }
  }, [conversationId, selectConversation]);

  // 直接访问 "/" 时恢复到最近的会话，保证 URL 与状态一致
  useEffect(() => {
    if (!conversationId && activeId && useChatStore.getState().conversations[activeId]) {
      navigate(`/chat/${activeId}`, { replace: true });
    }
  }, [conversationId, activeId, navigate]);

  // 会话被删除或链接失效时回退到最近会话
  useEffect(() => {
    if (conversationId && !useChatStore.getState().conversations[conversationId]) {
      navigate(activeId ? `/chat/${activeId}` : '/', { replace: true });
    }
  }, [conversationId, activeId, navigate]);

  const handleSend = useCallback(
    (text: string) => {
      const targetId = send(text);
      if (targetId && targetId !== conversationId) {
        navigate(`/chat/${targetId}`, { replace: true });
      }
    },
    [send, conversationId, navigate],
  );

  const handleNewChat = useCallback(() => {
    const id = createConversation();
    navigate(`/chat/${id}`);
  }, [createConversation, navigate]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      selectConversation(id);
      navigate(`/chat/${id}`);
    },
    [selectConversation, navigate],
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      void regenerate(messageId);
    },
    [regenerate],
  );

  const hasMessages = messages.length > 0;
  const headerTitle = useMemo(() => conversation?.title ?? '新的对话', [conversation?.title]);

  return (
    <div className="app-shell">
      <div className="app-backdrop" />
      <div className="app-body">
        <aside className="sidebar">
          <ChatSidebar onSelectConversation={handleSelectConversation} onNewChat={handleNewChat} />
        </aside>

        <ChatSidebarDrawer
          open={drawerOpen}
          onDismiss={() => setDrawerOpen(false)}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
        />

        <main className="chat-main">
          <ChatHeader
            title={headerTitle}
            settings={settings}
            onSettingsChange={updateSettings}
            onOpenSidebar={() => setDrawerOpen(true)}
          />

          <div className="chat-scroll" ref={scrollRef}>
            {hasMessages ? (
              <div className="chat-scroll-inner">
                <MessageList
                  messages={messages}
                  streamingMessageId={streamingMessageId}
                  onRegenerate={handleRegenerate}
                />
              </div>
            ) : (
              <WelcomeScreen onPick={handleSend} />
            )}
          </div>

          <Composer
            streaming={Boolean(streaming)}
            settings={settings}
            onSettingsChange={updateSettings}
            onSend={handleSend}
            onStop={stop}
          />
        </main>
      </div>
    </div>
  );
}
