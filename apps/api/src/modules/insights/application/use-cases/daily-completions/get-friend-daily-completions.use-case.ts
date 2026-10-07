import { ErrorCode } from "@aido/api/errors";

import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";
import { ApplicationException } from "#api/shared/domain/index";

import {
  buildDailyCompletionsRange,
  type DailyCompletionsRange,
} from "../../../domain/policies/daily-completions/daily-completion.js";
import { type DailyCompletionCachePort } from "../../ports/daily-completions/daily-completion-cache.port.js";
import { type FriendPort } from "../../ports/daily-completions/friend.port.js";
import { type TodoCompletionRepositoryPort } from "../../ports/daily-completions/todo-completion.repository.port.js";

export interface GetFriendDailyCompletionsInput {
  userId: string;
  friendUserId: string;
  startDate: string;
  endDate: string;
}

/**
 * 친구의 기간별 일일 완료 현황 조회 use-case (친구 캘린더용, 읽기 전용).
 *
 * 맞팔 관계를 확인한 뒤 친구의 PUBLIC 투두만 집계한다 — 친구 투두 목록과
 * 같은 공개 기준이라 캘린더 마커와 날짜별 목록이 항상 일치한다.
 * 캐시 키는 소유자(친구) 기준 공개 범위로 뷰어 무관 공유하며, 권한 확인은
 * 캐시 히트와 무관하게 매 요청 수행한다.
 */
interface GetFriendDailyCompletionsDependencies {
  readonly repository: TodoCompletionRepositoryPort;
  readonly cache: DailyCompletionCachePort;
  readonly friendPort: FriendPort;
}

export class GetFriendDailyCompletions {
  readonly #dependencies: GetFriendDailyCompletionsDependencies;

  constructor(dependencies: GetFriendDailyCompletionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetFriendDailyCompletionsInput): Promise<DailyCompletionsRange> {
    const { userId, friendUserId } = input;

    const isMutualFriend = await this.#dependencies.friendPort.isMutualFriend(userId, friendUserId);
    if (!isMutualFriend) {
      throw new ApplicationException(ErrorCode.FOLLOW_0906, {
        targetUserId: friendUserId,
      });
    }

    const start = parseDateOnly(input.startDate);
    const endInclusive = parseDateOnly(input.endDate);

    // 캐시 키 세그먼트는 파싱된 날짜를 YYYY-MM-DD로 정규화해 사용
    const startKey = toDateString(start);
    const endKey = toDateString(endInclusive);

    const cached = await this.#dependencies.cache.getPublicRange(friendUserId, startKey, endKey);
    if (cached !== undefined) {
      return cached;
    }

    // 조회 범위를 반열림 구간 [start, end)로 변환 (종료일 포함 위해 +1일)
    const aggregates = await this.#dependencies.repository.aggregatePublicByDateRange({
      userId: friendUserId,
      startDate: start,
      endDate: addDays(1, endInclusive),
    });

    const result = buildDailyCompletionsRange(aggregates, {
      startDate: input.startDate,
      endDate: input.endDate,
    });

    await this.#dependencies.cache.setPublicRange(friendUserId, startKey, endKey, result);

    return result;
  }
}
