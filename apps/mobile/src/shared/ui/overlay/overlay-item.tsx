import { type ReactNode, useState } from 'react';

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
}

export const OverlayItem = <T,>({ render, onUnmount, onResolve }: OverlayItemProps<T>) => {
  const [isOpen, setIsOpen] = useState(true);

  const close = (value: T) => {
    onResolve(value);
    setIsOpen(false);
  };

  return <>{render({ isOpen, close, unmount: onUnmount })}</>;
};
