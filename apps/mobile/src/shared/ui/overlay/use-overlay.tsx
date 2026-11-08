import { noop } from 'es-toolkit';
import { use, useCallback, useEffect, useId, useMemo, useRef } from 'react';

import { type OverlayAsyncRender, OverlayItem, type OverlayRender } from './overlay-item';
import { OverlayContext } from './overlay-provider';

export interface Overlay {
  open: (render: OverlayRender) => void;
  openAsync: <T>(render: OverlayAsyncRender<T>, options: OverlayAsyncOptions<T>) => Promise<T>;
}

interface OverlayAsyncOptions<T> {
  /** 답 없이 사라졌을 때(부른 컴포넌트 unmount, 다시 열기, `resetKey`) 돌려줄 값 */
  dismissedValue: T;
}

/** 열 때의 화면이 스냅샷으로 굳는다: 부모의 반응형 값(`isSubmitting={mutation.isPending}` 등)을 props로 넘기면 그 값에 얼어붙으므로, 띄우는 내용이 자기 상태를 스스로 가져야 한다 */
export function useOverlay(): Overlay {
  const controller = use(OverlayContext);

  if (!controller) {
    throw new Error('useOverlay must be used within OverlayProvider');
  }

  const id = useId();
  const generationRef = useRef(0);

  useEffect(() => {
    return () => controller.unmount(id);
  }, [controller, id]);

  const mount = useCallback(
    <T,>(render: OverlayAsyncRender<T>, onResolve: (value: T) => void, dismissedValue: T) => {
      const generation = ++generationRef.current;

      controller.mount(
        id,
        <OverlayItem<T>
          render={render}
          onResolve={onResolve}
          dismissedValue={dismissedValue}
          onUnmount={() => {
            if (generationRef.current === generation) {
              controller.unmount(id);
            }
          }}
        />,
      );
    },
    [controller, id],
  );

  const open = useCallback(
    (render: OverlayRender): void => {
      mount<void>(
        ({ close, ...props }) => render({ ...props, close: () => close() }),
        noop,
        undefined,
      );
    },
    [mount],
  );

  const openAsync = useCallback(
    <T,>(render: OverlayAsyncRender<T>, { dismissedValue }: OverlayAsyncOptions<T>): Promise<T> =>
      new Promise<T>((resolve) => mount(render, resolve, dismissedValue)),
    [mount],
  );

  return useMemo(() => ({ open, openAsync }), [open, openAsync]);
}
