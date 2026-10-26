import { createContext, use } from 'react';

/** 시트 route(transparentModal) 안에 둔 PortalHost 이름. route 밖이면 undefined다. */
export const SheetRoutePortalHostContext = createContext<string | undefined>(undefined);

/**
 * HeroUI `Dialog.Portal`에 넘길 대상. iOS FullWindowOverlay는 창에 바로 붙어 transparentModal 바깥에
 * 놓이므로 화면에는 보여도 VoiceOver·XCUITest가 모달 안만 읽어 다이얼로그를 찾지 못한다.
 * 시트 route 안에서는 그 모달 안의 PortalHost에 일반 View로 그린다.
 */
export function useDialogPortalTarget() {
  const hostName = use(SheetRoutePortalHostContext);
  if (hostName == null) {
    return {};
  }
  return { hostName, disableFullWindowOverlay: true };
}
