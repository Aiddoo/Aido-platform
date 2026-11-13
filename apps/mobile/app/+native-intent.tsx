import { rememberColdStartLink } from '@src/bootstrap/navigation/cold-start-link';
import {
  createInviteLinkOpenStamp,
  findInviteSystemPath,
} from '@src/features/social/invite/utils/invite-link.view-model';
import { ENV } from '@src/shared/config/env';
import { getNowInstant } from '@src/shared/date/clock';
import { toEpochMs } from '@src/shared/date/instant';
import { toSelectedTabPath } from '@src/shared/navigation/selected-tab-path';

const stampInviteLinkOpen = createInviteLinkOpenStamp();

/**
 * 초대 링크(https://aido.kr/i/…, aido://invite/…, 카카오톡 공유)만 다른 route로 바꾸고 OAuth 콜백·위젯·알림 URI의 경로는 그대로 둔다. 열린 시각(openedAt)을 붙여 착지 화면이 invite_link_opened를 링크마다 한 번만 남긴다.
 * 켜진 앱에 들어온 앱 링크는 보던 탭 그룹만 앞에 붙여, 시트·초대 카드가 맨 위여도 그 아래 보던 탭에 연다
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    const invitePath = findInviteSystemPath(
      path,
      { appScheme: ENV.SCHEME, kakaoScheme: ENV.KAKAO_SCHEME },
      { openedAt: stampInviteLinkOpen(path, toEpochMs(getNowInstant())) },
    );
    if (invitePath != null) {
      return invitePath;
    }
    if (initial) {
      rememberColdStartLink(path, ENV.SCHEME);
      return path;
    }
    return toSelectedTabUrl(path);
  } catch {
    return path;
  }
}

function toSelectedTabUrl(url: string) {
  const schemePrefix = `${ENV.SCHEME}://`;
  if (!url.startsWith(schemePrefix)) {
    return url;
  }
  const appPath = `/${url.slice(schemePrefix.length)}`;
  const tabPath = toSelectedTabPath(appPath);
  return tabPath === appPath ? url : tabPath;
}
