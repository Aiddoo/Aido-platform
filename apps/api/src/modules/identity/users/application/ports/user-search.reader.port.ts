import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserSearchMatchReadModel } from "../read-models/user-brief.read-model.js";

// tag는 대문자로 맞춘 Aido ID 조각, name은 이름 조각이다. excludedUserIds는 결과·개수에서 뺀다
export interface UserSearchCriteria {
  readonly tag: string;
  readonly name: string;
  readonly excludedUserIds: readonly UserId[];
}

// ACTIVE이고 탈퇴 대기 중이 아닌 사용자를 이름·Aido ID로 찾는다
export abstract class UserSearchReaderPort {
  // rank·id 오름차순이고 after 다음부터 준다
  abstract searchActiveUsers(params: {
    readonly criteria: UserSearchCriteria;
    readonly after: { readonly rank: number; readonly userId: UserId } | null;
    readonly limit: number;
  }): Promise<UserSearchMatchReadModel[]>;
  abstract countActiveUsers(criteria: UserSearchCriteria): Promise<number>;
}
