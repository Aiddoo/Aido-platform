import { type ReactNode, useState } from 'react';

export type OverlayRender<T = void> = (props: {
  isOpen: boolean;
  close: (value: T) => void;
  exit: () => void;
}) => ReactNode;

interface OverlayItemProps<T> {
  render: OverlayRender<T>;
  onUnmount: () => void;
  onResolve: (value: T) => void;
}

export const OverlayItem = <T,>({ render, onUnmount, onResolve }: OverlayItemProps<T>) => {
  const [isOpen, setIsOpen] = useState(true);

  const close = (value: T) => {
    onResolve(value);
    setIsOpen(false);
  };

  return <>{render({ isOpen, close, exit: onUnmount })}</>;
};
