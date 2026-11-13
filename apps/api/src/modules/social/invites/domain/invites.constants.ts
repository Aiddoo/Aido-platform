// drizzle-kit이 enums.schema.ts에서 이 파일을 상대 경로로 읽으므로 #api 별칭·Temporal 값을 두지 않는다.
// 튜플은 DB enum 값 목록이라 값과 순서를 바꾸면 마이그레이션이 생긴다

export const INVITE_STATUSES = ["ACTIVE", "REVOKED"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

// 코드가 겹치면 새 코드로 이만큼까지 다시 발급한다
export const INVITE_CODE_MAX_ATTEMPTS = 5;
