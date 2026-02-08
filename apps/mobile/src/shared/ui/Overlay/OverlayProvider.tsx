import {
  createContext,
  Fragment,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface OverlayController {
  mount: (id: string, element: ReactNode) => void;
  unmount: (id: string) => void;
}

export const OverlayContext = createContext<OverlayController | null>(null);

type OverlayEntry = { element: ReactNode; version: number };

export const OverlayProvider = ({ children }: { children: ReactNode }) => {
  const [overlays, setOverlays] = useState<Map<string, OverlayEntry>>(new Map());
  const versionRef = useRef(0);

  const mount = useCallback((id: string, element: ReactNode) => {
    const version = ++versionRef.current;
    setOverlays((prev) => {
      const next = new Map(prev);
      next.set(id, { element, version });
      return next;
    });
  }, []);

  const unmount = useCallback((id: string) => {
    setOverlays((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const controller = useMemo(() => ({ mount, unmount }), [mount, unmount]);

  return (
    <OverlayContext.Provider value={controller}>
      {children}
      {[...overlays.entries()].map(([id, { element, version }]) => (
        <Fragment key={`${id}-${version}`}>{element}</Fragment>
      ))}
    </OverlayContext.Provider>
  );
};
