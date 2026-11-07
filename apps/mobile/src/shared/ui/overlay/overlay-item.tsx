import { type ReactNode, useEffect, useState } from 'react';

interface OverlayRenderBaseProps {
  isOpen: boolean;
  unmount: () => void;
}

export type OverlayRender = (props: OverlayRenderBaseProps & { close: () => void }) => ReactNode;

export type OverlayAsyncRender<T> = (
  props: OverlayRenderBaseProps & { close: (value: T) => void },
) => ReactNode;

interface OverlayItemProps<T> {
  render: OverlayAsyncRender<T>;
  onUnmount: () => void;
  onResolve: (value: T) => void;
  dismissedValue: T;
}

export function OverlayItem<T>({
  render,
  onUnmount,
  onResolve,
  dismissedValue,
}: OverlayItemProps<T>) {
  const [isOpen, setIsOpen] = useState(true);

  const close = (value: T) => {
    onResolve(value);
    setIsOpen(false);
  };

  // 부른 컴포넌트 unmount, 다시 열기, resetKey 모두 이 항목이 트리에서 빠지는 일이라 한 곳에서 끝낸다.
  // close가 먼저 끝냈으면 Promise는 그 값을 유지한다.
  useEffect(() => () => onResolve(dismissedValue), [onResolve, dismissedValue]);

  return <>{render({ isOpen, close, unmount: onUnmount })}</>;
}
