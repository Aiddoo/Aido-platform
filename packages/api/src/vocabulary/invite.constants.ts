// 모음을 빼 단어가 만들어지지 않게 하고 0/O, 1/I/L처럼 헷갈리는 글자를 뺀 27자
export const INVITE_CODE = {
  LENGTH: 6,
  ALPHABET: "23456789BCDFGHJKMNPQRSTVWXZ",
} as const;

export const INVITE_CODE_PATTERN = `^[${INVITE_CODE.ALPHABET}]{${INVITE_CODE.LENGTH}}$` as const;

export const INVITE_LINK_BASE_URL = "https://aido.kr/i";

export const INVITE_REDEEM_WINDOW_DAYS = 7;

export const INVITE_QUALIFICATION = {
  MIN_ACTIVE_DAYS: 2,
  EXPIRE_AFTER_DAYS: 14,
} as const;

export const INVITE_REWARD_CAPS = {
  PREMIUM_DAYS_PER_30_DAYS: 30,
  PREMIUM_DAYS_TOTAL: 90,
} as const;

export const REWARD_TYPE = {
  PREMIUM_DAYS: "PREMIUM_DAYS",
  FRIEND_SLOT: "FRIEND_SLOT",
} as const;

export type RewardType = (typeof REWARD_TYPE)[keyof typeof REWARD_TYPE];

export const INVITEE_REWARDS = [{ rewardType: REWARD_TYPE.PREMIUM_DAYS, quantity: 7 }] as const;

// 3·5·10명 단계 보상은 행만 추가한다. 행의 모양은 contracts/invite의 inviterRewardMilestoneSchema가 검증한다.
// repeatEvery: 이 단계 뒤로 몇 명마다 같은 보상을 반복할지. null이면 한 번만 지급한다.
export const INVITER_REWARD_MILESTONES = [
  {
    qualifiedCount: 1,
    repeatEvery: 1,
    rewards: [
      { rewardType: REWARD_TYPE.PREMIUM_DAYS, quantity: 7 },
      { rewardType: REWARD_TYPE.FRIEND_SLOT, quantity: 1 },
    ],
  },
] as const;

export const REDEMPTION_STATUS = {
  JOINED: "JOINED",
  QUALIFIED: "QUALIFIED",
  REWARDED: "REWARDED",
  REJECTED: "REJECTED",
} as const;

export type RedemptionStatus = (typeof REDEMPTION_STATUS)[keyof typeof REDEMPTION_STATUS];

export const REDEMPTION_REJECTION_REASON = {
  EXPIRED: "EXPIRED",
  INVITER_MONTHLY_CAP: "INVITER_MONTHLY_CAP",
} as const;

export type RedemptionRejectionReason =
  (typeof REDEMPTION_REJECTION_REASON)[keyof typeof REDEMPTION_REJECTION_REASON];

export const REDEEM_OUTCOME = {
  REDEEMED: "REDEEMED",
  CONNECTED: "CONNECTED",
  ALREADY_FRIENDS: "ALREADY_FRIENDS",
} as const;

export type RedeemOutcome = (typeof REDEEM_OUTCOME)[keyof typeof REDEEM_OUTCOME];

export const INVITE_FRIENDSHIP = {
  FRIENDS: "FRIENDS",
  REQUESTED: "REQUESTED",
} as const;

export type InviteFriendship = (typeof INVITE_FRIENDSHIP)[keyof typeof INVITE_FRIENDSHIP];
