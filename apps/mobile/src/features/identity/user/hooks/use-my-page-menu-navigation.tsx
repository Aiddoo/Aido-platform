import { useMyPageDetailRootStore } from '@src/bootstrap/providers/di-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { usePaneSizeClass } from '@src/shared/ui';
import { type Href, router, usePathname } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { Keyboard } from 'react-native';

import { isMyPageMenuItemSelected } from '../utils/my-page-menu-navigation';

export type MyPageMenuPathname = Extract<Href, string>;

function createCurrentPathnameStore(initialPathname: string) {
  let pathname = initialPathname;
  const listeners = new Set<() => void>();

  return {
    get: () => pathname,
    set: (nextPathname: string) => {
      if (nextPathname === pathname) {
        return;
      }
      pathname = nextPathname;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

interface MyPageMenuNavigation {
  navigate: (target: Href) => void;
  currentPathname: ReturnType<typeof createCurrentPathnameStore>;
}

const MyPageMenuNavigationContext = createContext<MyPageMenuNavigation | null>(null);

/** 메뉴 행마다 경로·창 크기·연타 가드를 따로 구독하지 않게 메뉴 칸이 한 번만 구독해 내려 준다 */
export function MyPageMenuNavigationProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const isCompact = usePaneSizeClass() === 'compact';
  const detailRootStore = useMyPageDetailRootStore();
  const [currentPathname] = useState(() => createCurrentPathnameStore(pathname));

  useEffect(() => {
    currentPathname.set(pathname);
    detailRootStore.clear();
  }, [currentPathname, detailRootStore, pathname]);

  const navigate = useSingleTap((target: Href) => {
    if (pathname === (typeof target === 'string' ? target : target.pathname)) {
      return;
    }
    // 상세 칸 입력의 키보드가 새 화면 위에 남지 않게 내린다
    Keyboard.dismiss();
    // 넓은 화면은 상세를 고른 메뉴 하나로 바꾼다. 그 안에서 더 들어간 화면이 뒤로 가기에 남지 않게 먼저 걷어 낸다
    if (!isCompact && router.canDismiss()) {
      detailRootStore.request(typeof target === 'string' ? target : target.pathname);
      router.dismissAll();
    }
    router.push(target);
  });

  return (
    <MyPageMenuNavigationContext value={{ navigate, currentPathname }}>
      {children}
    </MyPageMenuNavigationContext>
  );
}

function useMyPageMenuNavigationContext(): MyPageMenuNavigation {
  const context = use(MyPageMenuNavigationContext);
  if (context == null) {
    throw new Error('MyPageMenuNavigationProvider 안에서만 쓸 수 있어요');
  }
  return context;
}

/** 정체성이 바뀌지 않아 경로가 바뀌어도 부른 행을 다시 그리지 않는다 */
export function useMyPageMenuNavigate() {
  return useMyPageMenuNavigationContext().navigate;
}

/** 이 항목의 선택 여부가 바뀔 때만 다시 그린다 */
export function useIsMyPageMenuItemSelected(targetPathname: MyPageMenuPathname): boolean {
  const { currentPathname } = useMyPageMenuNavigationContext();

  return useSyncExternalStore(currentPathname.subscribe, () =>
    isMyPageMenuItemSelected(currentPathname.get(), targetPathname),
  );
}
