import { ErrorCode } from "@aido/api/errors";

import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";
import { ApplicationException } from "#api/shared/domain/index";

import { buildDailyCompletionsRange } from "../../../domain/policies/daily-completions/daily-completion.policy.js";
import type { DailyCompletionsRange } from "../../../domain/records/daily-completions/daily-completion.record.js";
import { type DailyCompletionCachePort } from "../../ports/daily-completions/daily-completion-cache.port.js";
import { type DailyCompletionFollowReaderPort } from "../../ports/daily-completions/daily-completion-follow-reader.port.js";
import { type TodoCompletionRepositoryPort } from "../../ports/daily-completions/todo-completion.repository.port.js";

export interface GetFriendDailyCompletionsInput {
  readonly userId: string;
  readonly friendUserId: string;
  readonly startDate: string;
  readonly endDate: string;
}

interface GetFriendDailyCompletionsDependencies {
  readonly repository: Pick<TodoCompletionRepositoryPort, "aggregatePublicByDateRange">;
  readonly cache: Pick<DailyCompletionCachePort, "readPublicRange" | "storePublicRangeIfCurrent">;
  readonly followReader: Pick<DailyCompletionFollowReaderPort, "isMutualFriend">;
}

export class GetFriendDailyCompletions {
  readonly #dependencies: GetFriendDailyCompletionsDependencies;

  constructor(dependencies: GetFriendDailyCompletionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetFriendDailyCompletionsInput): Promise<DailyCompletionsRange> {
    const { userId, friendUserId } = input;

    const isMutualFriend = await this.#dependencies.followReader.isMutualFriend(
      userId,
      friendUserId,
    );
    if (!isMutualFriend) {
      throw new ApplicationException(ErrorCode.FOLLOW_0906, {
        targetUserId: friendUserId,
      });
    }

    const start = parseDateOnly(input.startDate);
    const endInclusive = parseDateOnly(input.endDate);

    const startKey = toDateString(start);
    const endKey = toDateString(endInclusive);

    const cacheRead = await this.#dependencies.cache.readPublicRange(
      friendUserId,
      startKey,
      endKey,
    );
    if (cacheRead.value !== undefined) {
      return cacheRead.value;
    }

    const aggregates = await this.#dependencies.repository.aggregatePublicByDateRange({
      userId: friendUserId,
      startDate: start,
      endDate: addDays(1, endInclusive),
    });

    const result = buildDailyCompletionsRange(aggregates, {
      startDate: input.startDate,
      endDate: input.endDate,
    });

    await this.#dependencies.cache.storePublicRangeIfCurrent(
      friendUserId,
      startKey,
      endKey,
      cacheRead.generation,
      result,
    );

    return result;
  }
}
