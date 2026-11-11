import { INVITEE_REWARDS, INVITER_REWARD_MILESTONES } from '@aido/api/vocabulary';

import { InviteRewardPolicy } from '../domains/invite-reward.model';
import { isOneTimeMilestone } from '../domains/invite.model';

/** 내 초대 화면 요약에 보여 줄 친구 수 */
export const INVITED_FRIEND_SUMMARY_LIMIT = 5;

// 카카오톡 피드 썸네일. 랜딩(aido.kr)이 정적 자산으로 제공한다
// 크기를 함께 보내야 카카오톡이 1:1로 잘라내지 않고 2:1 원본 비율로 보여 준다
export const INVITE_SHARE_IMAGE = {
  url: 'https://aido.kr/images/invite-share.png',
  width: 1600,
  height: 800,
} as const;

/** 초대받은 사람이 가입하면 받는 프리미엄 일수(초대 카드 영수증) */
export const INVITEE_PREMIUM_DAYS = InviteRewardPolicy.getPremiumDays(INVITEE_REWARDS);

/**
 * 초대한 사람이 첫 발자국에서 받는 프리미엄 일수. 내 초대 정보를 받기 전 안내에만 쓰고,
 * 받은 뒤에는 서버가 정한 다음 단계(InvitePolicy.getNextPremiumDays)를 쓴다.
 */
export const FIRST_INVITER_PREMIUM_DAYS = InviteRewardPolicy.getPremiumDays(
  INVITER_REWARD_MILESTONES[0].rewards,
);

/** 발자국 판에 생선 칸으로 미리 보여 줄 단계의 친구 수 */
export const ONE_TIME_MILESTONE_COUNTS = INVITER_REWARD_MILESTONES.filter(isOneTimeMilestone).map(
  (milestone) => milestone.qualifiedCount,
);
