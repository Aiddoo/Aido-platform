import { createContext, use } from 'react';

interface PortalTarget {
  hostName: string;
  disableFullWindowOverlay: boolean;
}

export const PortalTargetContext = createContext<PortalTarget | undefined>(undefined);

// 앱 기본 PortalHost는 Query·DI 바깥이라 OverlayProvider의 호스트에 그린다
// iOS FullWindowOverlay는 transparentModal 바깥에 놓여 VoiceOver·XCUITest가 모달 안만 읽으므로 시트 route 안에서는 일반 View로 그린다
export function usePortalTarget() {
  return use(PortalTargetContext) ?? {};
}
