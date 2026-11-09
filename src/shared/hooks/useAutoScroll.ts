import { useEffect, useRef } from 'react';

interface Options {
  /** 距离底部多少像素内视为「跟随」状态 */
  threshold?: number;
}

/**
 * 流式输出时自动滚动到底部；当用户主动向上翻阅时暂停跟随。
 * 返回的 ref 需挂到滚动容器上。
 */
export function useAutoScroll<T extends HTMLElement>(deps: unknown[], options: Options = {}) {
  const { threshold = 120 } = options;
  const ref = useRef<T | null>(null);
  const followRef = useRef(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const onScroll = () => {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
      followRef.current = distance <= threshold;
    };

    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, [threshold]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !followRef.current) return;
    element.scrollTop = element.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
