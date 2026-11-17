import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserSearchMatchReadModel } from "../read-models/user-brief.read-model.js";

// tag는 대문자로 맞춘 Aido ID 조각, name은 이름 조각이다. 검색한 본인과 exclusion에 걸린 사람은 결과·개수에서 뺀다
export interface UserSearchCriteria<TExclusion> {
  readonly tag: string;
  readonly name: string;
  readonly searcherId: UserId;
  readonly exclusion: TExclusion;
}

// ACTIVE이고 탈퇴 대기 중이 아닌 사용자를 이름·Aido ID로 찾는다
// TExclusion은 호출한 Context가 자기 테이블로 만든 SQL 조건이라 영속성 어댑터끼리만 모양을 안다(UserExclusionCondition)
export abstract class UserSearchReaderPort<TExclusion> {
  // rank·id 오름차순이고 after 다음부터 준다
  abstract searchActiveUsers(params: {
    readonly criteria: UserSearchCriteria<TExclusion>;
    readonly after: { readonly rank: number; readonly userId: UserId } | null;
    readonly limit: number;
  }): Promise<UserSearchMatchReadModel[]>;
  abstract countActiveUsers(criteria: UserSearchCriteria<TExclusion>): Promise<number>;
}
