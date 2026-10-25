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

function toInvitePath(rawCode: string | null, source: InviteLinkSource) {
  const inviteCode = rawCode == null ? null : parseInviteCode(rawCode);
  // 형식이 맞지 않으면 코드 입력 화면에서 다시 확인하게 한다
  return inviteCode == null ? `/invite?source=${source}` : `/invite/${inviteCode}?source=${source}`;
}

/**
 * 시스템이 연 URL 중 초대 링크만 앱 라우트로 바꾼다.
 * 초대가 아니면 null을 돌려주어 OAuth 콜백·위젯·알림 URI를 그대로 통과시킨다.
 */
export function resolveInviteSystemPath(path: string, options: InviteSystemPathOptions) {
  if (path.startsWith(INVITE_LINK_PREFIX)) {
    return toInvitePath(toInviteSegment(path.slice(INVITE_LINK_PREFIX.length)), 'universal_link');
  }

  if (path.startsWith(RELATIVE_INVITE_LINK_PREFIX)) {
    return toInvitePath(
      toInviteSegment(path.slice(RELATIVE_INVITE_LINK_PREFIX.length)),
      'universal_link',
    );
  }

  const appInvitePrefix = `${options.appScheme}://invite`;
  if (path === appInvitePrefix || path.startsWith(`${appInvitePrefix}/`)) {
    const segment = toInviteSegment(path.slice(appInvitePrefix.length + 1));
    return toInvitePath(segment === '' ? null : segment, 'app_scheme');
  }

  if (options.kakaoScheme != null && path.startsWith(`${options.kakaoScheme}://kakaolink`)) {
    // Linking.parse도 안에서 같은 URL 파서를 쓰지만 Expo Go 호스트를 지우려 Constants를 읽어 순수 함수가 아니게 된다
    return toInvitePath(new URL(path).searchParams.get('inviteCode'), 'kakao');
  }

  return null;
}
