import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 프롬프트용 최소 카테고리 정보. */
export interface UserCategory {
  readonly id: number;
  readonly name: string;
}

/** 프롬프트 조립에 쓰는 사용자 카테고리. planning 내부에 기대지 않도록 포트로 둔다. */
export abstract class UserCategoryReaderPort {
  abstract findByUserId(userId: UserId): Promise<UserCategory[]>;
}
