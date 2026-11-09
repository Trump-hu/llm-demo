import { App, Button, Tooltip } from 'antd';
import {
  CopyOutlined,
  DislikeFilled,
  DislikeOutlined,
  LikeFilled,
  LikeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useChatStore } from '../store/chatStore';

interface MessageActionsProps {
  messageId: string;
  content: string;
  onRegenerate?: () => void;
}

export function MessageActions({ messageId, content, onRegenerate }: MessageActionsProps) {
  const { message } = App.useApp();
  const feedback = useChatStore((state) => state.feedback[messageId]);
  const setFeedback = useChatStore((state) => state.setFeedback);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      message.success('已复制到剪贴板');
    } catch {
      message.error('复制失败，请手动选择文本');
    }
  };

  return (
    <div className="message-actions">
      <Tooltip title="复制">
        <Button type="text" size="small" icon={<CopyOutlined />} onClick={copy} />
      </Tooltip>
      {onRegenerate && (
        <Tooltip title="重新生成">
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={onRegenerate} />
        </Tooltip>
      )}
      <Tooltip title="有帮助">
        <Button
          type="text"
          size="small"
          className={feedback === 'like' ? 'is-on' : undefined}
          icon={feedback === 'like' ? <LikeFilled /> : <LikeOutlined />}
          onClick={() => setFeedback(messageId, feedback === 'like' ? null : 'like')}
        />
      </Tooltip>
      <Tooltip title="需要改进">
        <Button
          type="text"
          size="small"
          className={feedback === 'dislike' ? 'is-on' : undefined}
          icon={feedback === 'dislike' ? <DislikeFilled /> : <DislikeOutlined />}
          onClick={() => setFeedback(messageId, feedback === 'dislike' ? null : 'dislike')}
        />
      </Tooltip>
    </div>
  );
}
