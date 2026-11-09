import { ThunderboltFilled, UserOutlined } from '@ant-design/icons';
import type { ChatMessage } from '@/core/agent/types';
import { messageToPlainText } from '@/core/agent/eventReducer';
import { MarkdownContent } from './MarkdownContent';
import { ThinkingPanel } from './ThinkingPanel';
import { ToolCallCard } from './ToolCallCard';
import { MessageActions } from './MessageActions';

interface MessageItemProps {
  message: ChatMessage;
  isStreaming: boolean;
  onRegenerate?: (messageId: string) => void;
}

export function MessageItem({ message, isStreaming, onRegenerate }: MessageItemProps) {
  const plainText = messageToPlainText(message);
  const lastPart = message.parts[message.parts.length - 1];
  const showCaret = isStreaming && lastPart?.type === 'text';
  const isEmpty = message.parts.length === 0;

  if (message.role === 'user') {
    return (
      <div className="message is-user">
        <div className="message-bubble">{plainText}</div>
        <div className="message-avatar">
          <UserOutlined />
        </div>
      </div>
    );
  }

  return (
    <div className="message is-agent">
      <div className="message-avatar is-agent">
        <ThunderboltFilled />
      </div>
      <div className="message-body">
        <div className="message-name">
          <span>Nexus Agent</span>
          {message.model && <span className="message-model">{message.model}</span>}
        </div>

        <div className="message-parts">
          {isEmpty && isStreaming && (
            <div className="typing-dots" aria-label="正在生成">
              <i />
              <i />
              <i />
            </div>
          )}

          {message.parts.map((part, index) => {
            if (part.type === 'reasoning') {
              return (
                <ThinkingPanel
                  key={`reasoning-${index}`}
                  text={part.text}
                  streaming={isStreaming && index === message.parts.length - 1}
                />
              );
            }
            if (part.type === 'tool-call') {
              return <ToolCallCard key={part.id} part={part} />;
            }
            const streamingText = showCaret && index === message.parts.length - 1;
            return (
              <div key={`text-${index}`}>
                <MarkdownContent content={part.text} streaming={streamingText} />
              </div>
            );
          })}

          {message.status === 'error' && (
            <div className="message-error">生成中断：{message.error ?? '未知错误'}</div>
          )}
        </div>

        {message.status === 'done' && plainText.length > 0 && (
          <MessageActions
            messageId={message.id}
            content={plainText}
            onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
          />
        )}
      </div>
    </div>
  );
}
