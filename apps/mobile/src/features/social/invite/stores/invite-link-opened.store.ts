const MAX_TRACKED_OPEN_KEYS = 20;

export interface InviteLinkOpenedStore {
  /** 처음 본 열림이면 기억하고 true, 이미 센 열림이면 false */
  markOpened(openKey: string): boolean;
}

/**
 * 같은 링크 열림(source + openedAt)으로 화면이 다시 마운트돼도 `invite_link_opened`를 한 번만 남긴다.
 * 앱이 떠 있는 동안 쌓이지 않게 최근 열림만 기억한다(Set은 삽입 순서를 지킨다)
 */
export function createInviteLinkOpenedStore(): InviteLinkOpenedStore {
  const openKeys = new Set<string>();

  return {
    markOpened: (openKey) => {
      if (openKeys.has(openKey)) {
        return false;
      }
      openKeys.add(openKey);
      for (const oldestKey of openKeys) {
        if (openKeys.size <= MAX_TRACKED_OPEN_KEYS) {
          break;
        }
        openKeys.delete(oldestKey);
      }
      return true;
    },
  };
}
