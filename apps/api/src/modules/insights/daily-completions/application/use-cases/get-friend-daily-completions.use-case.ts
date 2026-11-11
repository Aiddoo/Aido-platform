import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { countCompleteDays } from "../../domain/daily-completion.domain-service.js";
import { DateRange } from "../../domain/date-range.vo.js";
import { notMutualFriend } from "../daily-completions.errors.js";
import type { DailyCompletionCachePort } from "../ports/daily-completion-cache.port.js";
import type { DailyCompletionRepositoryPort } from "../ports/daily-completion.repository.port.js";
import type { FriendshipReaderPort } from "../ports/friendship.reader.port.js";
import type { DailyCompletionRange } from "../read-models/daily-completion-range.read-model.js";

export interface GetFriendDailyCompletionsQuery {
  readonly userId: string;
  readonly friendUserId: string;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate;
}

export interface GetFriendDailyCompletionsDependencies {
  readonly dailyCompletionRepository: Pick<DailyCompletionRepositoryPort, "listPublicByDateRange">;
  readonly dailyCompletionCache: Pick<
    DailyCompletionCachePort,
    "readPublicRange" | "storePublicRangeIfCurrent"
  >;
  readonly friendshipReader: Pick<FriendshipReaderPort, "isMutualFriend">;
}

export class GetFriendDailyCompletionsUseCase {
  readonly #dependencies: GetFriendDailyCompletionsDependencies;

  constructor(dependencies: GetFriendDailyCompletionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetFriendDailyCompletionsQuery): Promise<DailyCompletionRange> {
    const { dailyCompletionRepository, dailyCompletionCache, friendshipReader } =
      this.#dependencies;
    const friendUserId = UserId.reconstitute(query.friendUserId);

    // 친구가 아니면 날짜를 보기 전에 거절한다(기존 오류 우선순위)
    if (!(await friendshipReader.isMutualFriend(UserId.reconstitute(query.userId), friendUserId))) {
      throw notMutualFriend(friendUserId);
    }

    const range = DateRange.create(query.startDate, query.endDate);
    const cached = await dailyCompletionCache.readPublicRange(friendUserId, range);
    if (cached.value != null) {
      return cached.value;
    }

    const completions = await dailyCompletionRepository.listPublicByDateRange({
      userId: friendUserId,
      range,
    });
    const result: DailyCompletionRange = {
      range,
      completions,
      totalCompleteDays: countCompleteDays(completions),
    };

    await dailyCompletionCache.storePublicRangeIfCurrent(friendUserId, cached.generation, result);
    return result;
  }
}
