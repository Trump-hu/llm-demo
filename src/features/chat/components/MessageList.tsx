import type { ChatMessage } from '@/core/agent/types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: ChatMessage[];
  streamingMessageId: string | null;
  onRegenerate?: (messageId: string) => void;
}

export function MessageList({ messages, streamingMessageId, onRegenerate }: MessageListProps) {
  return (
    <>
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          isStreaming={streamingMessageId === message.id}
          onRegenerate={onRegenerate}
        />
      ))}
    </>
  );
}
