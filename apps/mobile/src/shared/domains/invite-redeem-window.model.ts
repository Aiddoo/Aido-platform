import { INVITE_REDEEM_WINDOW_DAYS } from '@aido/api/vocabulary';
import { DAY_MS } from '@src/shared/constants/time-units';
import { diffMs, type Instant } from '@src/shared/date/instant';

// 서버 isWithinRedeemWindow와 같다. 시작 시각에서 7일(24시간 단위)이 지나기 전까지만 초대 보상을 기대한다. 최종 판정은 서버다
export function isWithinInviteRedeemWindow(startedAt: Instant, now: Instant): boolean {
  return diffMs(now, startedAt) < INVITE_REDEEM_WINDOW_DAYS * DAY_MS;
}
