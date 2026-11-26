import { LANDING_ORIGIN } from '@src/shared/constants/landing-origin';

export const INVITED_FRIEND_SUMMARY_LIMIT = 5;

// 카카오톡 피드 썸네일. 랜딩이 정적 자산으로 제공한다
// 크기를 함께 보내야 카카오톡이 1:1로 잘라내지 않고 2:1 원본 비율로 보여 준다
export const INVITE_SHARE_IMAGE = {
  url: `${LANDING_ORIGIN}/images/invite-share.png`,
  width: 1600,
  height: 800,
} as const;
