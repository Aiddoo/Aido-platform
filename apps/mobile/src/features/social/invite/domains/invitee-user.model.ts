import { INVITE_REDEEM_WINDOW_DAYS } from '@aido/api/vocabulary';
import type { User } from '@src/features/identity/user/domains/user.model';
import { DAY_MS } from '@src/shared/constants/time-units';
import { diffMs, type Instant } from '@src/shared/date/instant';

// 가입한 지 며칠 안 된 계정만 보상을 기대할 수 있다. 최종 판정은 서버다
function isRewardExpected(user: User, now: Instant) {
  return diffMs(now, user.createdAt) < INVITE_REDEEM_WINDOW_DAYS * DAY_MS;
}

/** 초대받은 사람의 계정으로 보는 보상 기대 */
export const InviteeUserPolicy = {
  isRewardExpected,
} as const;
