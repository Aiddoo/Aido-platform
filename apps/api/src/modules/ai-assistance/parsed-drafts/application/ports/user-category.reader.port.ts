import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserCategoryReadModel } from "../read-models/user-category.read-model.js";

/** 프롬프트 조립에 쓰는 사용자 카테고리. planning 내부에 기대지 않도록 포트로 둔다. */
export abstract class UserCategoryReaderPort {
  abstract listByUserId(userId: UserId): Promise<UserCategoryReadModel[]>;
}
