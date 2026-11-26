import type { ReactNode } from 'react';
import { ReservedRegionsProvider } from 'react-native-reserved-regions';

interface PaneRegionsProviderProps {
  children: ReactNode;
}

/** 접힘선을 칸의 좌표로 재게 한다. Android는 칸이 창 왼쪽 끝에서 시작해 앱 루트 provider의 좌표가 칸 좌표와 같다 */
export function PaneRegionsProvider({ children }: PaneRegionsProviderProps) {
  // Android의 ReservedRegionsView는 처음 붙을 때 이벤트를 동기로 보내, 화면을 그리는 중에 새로 붙으면(날씨) Hermes가 죽는다
  if (process.env.EXPO_OS === 'android') {
    return children;
  }

  return <ReservedRegionsProvider style={{ flex: 1 }}>{children}</ReservedRegionsProvider>;
}
