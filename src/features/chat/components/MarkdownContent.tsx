import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownContentProps {
  content: string;
  /** 流式输出中：在最后一个块级元素尾部渲染光标 */
  streaming?: boolean;
}

/** 助手正文渲染：GFM + 代码高亮。memo 避免流式更新时整段重渲染 */
export const MarkdownContent = memo(function MarkdownContent({
  content,
  streaming = false,
}: MarkdownContentProps) {
  return (
    <div className={`markdown ${streaming ? 'is-streaming' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
