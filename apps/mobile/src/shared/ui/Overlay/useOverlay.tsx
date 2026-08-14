import { useContext, useEffect, useId, useRef } from 'react';

import { OverlayItem, type OverlayRender } from './OverlayItem';
import { OverlayContext } from './OverlayProvider';

export const useOverlay = () => {
  const controller = useContext(OverlayContext);

  if (!controller) {
    throw new Error('useOverlay must be used within OverlayProvider');
  }

  const id = useId();
  const generationRef = useRef(0);

  useEffect(() => {
    return () => controller.unmount(id);
  }, [controller, id]);

  const open = <T = void,>(render: OverlayRender<T>): Promise<T> => {
    const generation = ++generationRef.current;

    return new Promise<T>((resolve) => {
      controller.mount(
        id,
        <OverlayItem<T>
          render={render}
          onResolve={resolve}
          onUnmount={() => {
            if (generationRef.current === generation) {
              controller.unmount(id);
            }
          }}
        />,
      );
    });
  };

  return { open };
};
