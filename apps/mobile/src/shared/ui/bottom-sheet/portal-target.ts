import { createContext, use } from 'react';

interface PortalTarget {
  hostName: string;
  disableFullWindowOverlay: boolean;
}

export const PortalTargetContext = createContext<PortalTarget | undefined>(undefined);

/**
 * HeroUI `*.Portal`에 넘길 대상. 앱 기본 PortalHost는 Query·DI 바깥이라 OverlayProvider의 호스트에 그린다.
 * iOS FullWindowOverlay는 창에 바로 붙어 transparentModal 바깥에 놓이므로 화면에는 보여도
 * VoiceOver·XCUITest가 모달 안만 읽어 내용을 찾지 못한다. 그래서 시트 route 안에서는 일반 View로 그린다.
 */
export function usePortalTarget() {
  return use(PortalTargetContext) ?? {};
}
