import {
  createInviteLinkOpenStamp,
  resolveInviteSystemPath,
} from '@src/features/invite/utils/navigation/invite-system-path';
import { ENV } from '@src/shared/config/env';

const stampInviteLinkOpen = createInviteLinkOpenStamp();

/**
 * 시스템이 연 URL을 앱 라우트로 바꾼다. 초대 링크(https://aido.kr/i/…, aido://invite/…, 카카오톡 공유)만
 * 바꾸고 OAuth 콜백·위젯·알림 URI는 손대지 않는다. 해석에 실패해도 원래 경로로 연다.
 * 열린 시각(openedAt)을 붙여 착지 화면이 invite_link_opened를 링크마다 한 번만 남긴다.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return (
      resolveInviteSystemPath(
        path,
        { appScheme: ENV.SCHEME, kakaoScheme: ENV.KAKAO_SCHEME },
        { openedAt: stampInviteLinkOpen(path, Date.now()) },
      ) ?? path
    );
  } catch {
    return path;
  }
}
