import { INVITE_LINK_BASE_URL } from '@aido/api';

import type { InviteLinkSource } from '../../domains/invite-redemption.model';
import { parseInviteCode } from '../../domains/invite.model';

export interface InviteSystemPathOptions {
  /** 이 빌드의 앱 스킴 (aido, aido-preview, aido-dev) */
  appScheme: string;
  /** 카카오톡 공유 버튼이 여는 스킴 (kakao{네이티브 앱 키}). 키가 없는 빌드는 null */
  kakaoScheme: string | null;
}

const INVITE_LINK_PREFIX = `${INVITE_LINK_BASE_URL}/`;
const RELATIVE_INVITE_LINK_PREFIX = '/i/';

function stripQueryAndHash(value: string) {
  return value.split(/[?#]/, 1)[0] ?? '';
}

function toInviteSegment(rawCode: string) {
  return stripQueryAndHash(rawCode).replace(/\/+$/, '');
}

interface InviteLinkMatch {
  rawCode: string | null;
  source: InviteLinkSource;
}

function matchInviteLink(path: string, options: InviteSystemPathOptions): InviteLinkMatch | null {
  if (path.startsWith(INVITE_LINK_PREFIX)) {
    return {
      rawCode: toInviteSegment(path.slice(INVITE_LINK_PREFIX.length)),
      source: 'universal_link',
    };
  }

  if (path.startsWith(RELATIVE_INVITE_LINK_PREFIX)) {
    return {
      rawCode: toInviteSegment(path.slice(RELATIVE_INVITE_LINK_PREFIX.length)),
      source: 'universal_link',
    };
  }

  const appInvitePrefix = `${options.appScheme}://invite`;
  if (path === appInvitePrefix || path.startsWith(`${appInvitePrefix}/`)) {
    const segment = toInviteSegment(path.slice(appInvitePrefix.length + 1));
    return { rawCode: segment === '' ? null : segment, source: 'app_scheme' };
  }

  if (options.kakaoScheme != null && path.startsWith(`${options.kakaoScheme}://kakaolink`)) {
    // Linking.parse도 안에서 같은 URL 파서를 쓰지만 Expo Go 호스트를 지우려 Constants를 읽어 순수 함수가 아니게 된다
    return { rawCode: new URL(path).searchParams.get('inviteCode'), source: 'kakao' };
  }

  return null;
}

// 같은 URL이 짧은 사이에 다시 들어오면(초기 URL과 링크 이벤트가 겹칠 때) 같은 열림으로 본다
const SAME_OPEN_WINDOW_MS = 1000;

/**
 * 링크가 열린 시각을 정한다. 같은 URL이 잠깐 사이에 다시 들어오면 앞의 시각을 돌려줘
 * 착지 화면이 invite_link_opened를 한 번만 남기게 한다.
 */
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

/**
 * 시스템이 연 URL 중 초대 링크만 앱 라우트로 바꾼다.
 * 초대가 아니면 null을 돌려주어 OAuth 콜백·위젯·알림 URI를 그대로 통과시킨다.
 */
export function resolveInviteSystemPath(
  path: string,
  options: InviteSystemPathOptions,
  { openedAt }: { openedAt: number },
) {
  const link = matchInviteLink(path, options);
  if (link == null) {
    return null;
  }

  const inviteCode = link.rawCode == null ? null : parseInviteCode(link.rawCode);
  // 형식이 맞지 않으면 코드 입력 화면에서 다시 확인하게 한다
  const query = `source=${link.source}&openedAt=${openedAt}`;
  return inviteCode == null ? `/invite?${query}` : `/invite/${inviteCode}?${query}`;
}
