// drizzle-kit이 enums.schema.ts에서 이 파일을 상대 경로로 읽으므로 #api 별칭·Temporal 값을 두지 않는다.
// 튜플은 DB enum 값 목록이라 값과 순서를 바꾸면 마이그레이션이 생긴다

export const INVITE_STATUSES = ["ACTIVE", "REVOKED"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const REWARD_CLAIM_KINDS = ["INSTALLATION", "IDENTITY"] as const;
export type RewardClaimKind = (typeof REWARD_CLAIM_KINDS)[number];

export const REWARD_GRANT_STATUSES = ["PENDING", "APPLIED", "FAILED"] as const;
export type RewardGrantStatus = (typeof REWARD_GRANT_STATUSES)[number];

/** 보상 출처. 챌린지 같은 다른 출처는 값만 추가한다. */
export const REWARD_SOURCE_TYPES = ["INVITE_REDEMPTION"] as const;
export type RewardSourceType = (typeof REWARD_SOURCE_TYPES)[number];

const INVITE_REJECTION_CAUSES = [
  "SELF_INVITE",
  "BLOCKED",
  "INVITE_REVOKED",
  "ALREADY_REDEEMED",
] as const;
export type InviteRejectionCause = (typeof INVITE_REJECTION_CAUSES)[number];

/** 코드가 겹치면 새 코드로 이만큼까지 다시 발급한다. */
export const INVITE_CODE_MAX_ATTEMPTS = 5;

/**
 * 이 횟수만큼 실패한 지급은 자동으로 다시 시도하지 않는다. 큐 재시도는 세지 않고 지급 작업의
 * 첫 실행(수락·사용 시작·하루 한 번 정비 재시도)마다 한 번 센다. 그래서 첫 실행과 정비 재시도 4일이다.
 */
export const INVITE_REWARD_MAX_ATTEMPTS = 5;

export const INVITE_QUALIFY_REMINDER = {
  /** 사용 시작 마감이 이 일수 안으로 들어온 수락만 알린다. 정비 작업이 하루 한 번 돌아 마감 2~3일 전에 고른다. */
  LEAD_DAYS: 3,
  /** 초대받은 사람 시간대의 이 시각에 보낸다. 할 일을 마무리하는 저녁이면서 야간(21시) 전이다. */
  LOCAL_TIME: "18:00",
} as const;
