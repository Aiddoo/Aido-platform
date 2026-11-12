import { rememberColdStartLink } from '@src/bootstrap/navigation/cold-start-link';
import {
  createInviteLinkOpenStamp,
  findInviteSystemPath,
} from '@src/features/social/invite/utils/invite-link.view-model';
import { ENV } from '@src/shared/config/env';
import { getNowInstant } from '@src/shared/date/clock';
import { toEpochMs } from '@src/shared/date/instant';

const stampInviteLinkOpen = createInviteLinkOpenStamp();

/** 초대 링크(https://aido.kr/i/…, aido://invite/…, 카카오톡 공유)만 바꾸고 OAuth 콜백·위젯·알림 URI는 손대지 않는다. 열린 시각(openedAt)을 붙여 착지 화면이 invite_link_opened를 링크마다 한 번만 남긴다 */
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
    }
    return path;
  } catch {
    return path;
  }
}
