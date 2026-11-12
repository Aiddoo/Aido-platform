import { PortalHost } from 'heroui-native';
import {
  createContext,
  Fragment,
  type ReactNode,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { PortalTargetContext } from '../bottom-sheet/portal-target';
import { OverlayStateContext } from './overlay-state-context';

export interface OverlayController {
  mount: (id: string, element: ReactNode) => void;
  unmount: (id: string) => void;
}

export const OverlayContext = createContext<OverlayController | null>(null);

type OverlayEntry = { element: ReactNode; version: number };

export function OverlayProvider({
  children,
  resetKey,
  disableFullWindowOverlay = false,
}: {
  children: ReactNode;
  resetKey?: string;
  /** 시트 route처럼 이미 네이티브 모달 안이면 켠다 */
  disableFullWindowOverlay?: boolean;
}) {
  const [overlays, setOverlays] = useState<Map<string, OverlayEntry>>(new Map());
  const versionRef = useRef(0);
  const hostName = useId();
  const portalTarget = useMemo(
    () => ({ hostName, disableFullWindowOverlay }),
    [hostName, disableFullWindowOverlay],
  );

  useLayoutEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- resetKey(화면 경로)가 바뀌면 떠 있던 오버레이를 한 번에 걷는다
    setOverlays((previous) => (previous.size === 0 ? previous : new Map()));
  }, [resetKey]);

  const mount = useCallback((id: string, element: ReactNode) => {
    const version = ++versionRef.current;
    setOverlays((previous) => {
      const next = new Map(previous);
      next.set(id, { element, version });
      return next;
    });
  }, []);

  const unmount = useCallback((id: string) => {
    setOverlays((previous) => {
      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  }, []);

  const controller = useMemo(() => ({ mount, unmount }), [mount, unmount]);
  const state = useMemo(() => ({ hasActiveOverlay: overlays.size > 0 }), [overlays.size]);

  return (
    <OverlayContext value={controller}>
      <OverlayStateContext value={state}>
        <PortalTargetContext value={portalTarget}>
          {children}
          {[...overlays.entries()].map(([id, { element, version }]) => (
            <Fragment key={`${id}-${version}`}>{element}</Fragment>
          ))}
          <PortalHost name={hostName} />
        </PortalTargetContext>
      </OverlayStateContext>
    </OverlayContext>
  );
}
