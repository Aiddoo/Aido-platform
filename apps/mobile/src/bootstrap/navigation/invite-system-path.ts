import {
  type InviteLinkSchemes,
  parseInviteLink,
} from '@src/features/social/invite/apis/invite.mapper';
import { SECOND_MS } from '@src/shared/constants/time-units';

// 같은 URL이 짧은 사이에 다시 들어오면(초기 URL과 링크 이벤트가 겹칠 때) 같은 열림으로 본다
const SAME_OPEN_WINDOW_MS = SECOND_MS;

/** 착지 화면이 invite_link_opened를 한 번만 남기게 한다 */
export function createInviteLinkOpenStamp() {
  let last: { path: string; openedAt: number } | null = null;

  return (path: string, now: number) => {
    if (last != null && last.path === path && now - last.openedAt < SAME_OPEN_WINDOW_MS) {
      return last.openedAt;
    }

    last = { path, openedAt: now };
    return now;
  };
}

/** 초대가 아니면 null을 돌려주어 OAuth 콜백·위젯·알림 URI를 그대로 통과시킨다 */
export function findInviteSystemPath(
  path: string,
  schemes: InviteLinkSchemes,
  { openedAt }: { openedAt: number },
) {
  const link = parseInviteLink(path, schemes);
  if (link == null) {
    return null;
  }

  // 형식이 맞지 않으면 코드 입력 화면에서 다시 확인하게 한다
  const query = `source=${link.source}&openedAt=${openedAt}`;
  return link.inviteCode == null ? `/invite?${query}` : `/invite/${link.inviteCode}?${query}`;
}
