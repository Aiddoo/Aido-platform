import { Inject, Injectable } from "@nestjs/common";

import {
  TODO_CATEGORY_COUNT_READER,
  type TodoCategoryCountReaderPort,
} from "#api/modules/planning/categories/planning-categories.public";
import {
  CHEER_USAGE_READER,
  type DailySendUsage,
  type DailySendUsageReaderPort,
} from "#api/modules/social/cheers/social-cheers.public";
import {
  FRIEND_COUNT_READER,
  type FriendCountReaderPort,
} from "#api/modules/social/friends/social-friends.public";
import { NUDGE_USAGE_READER } from "#api/modules/social/nudges/social-nudges.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";

import {
  OwnedFeatureUsageReaderPort,
  type OwnedFeatureUsage,
} from "../../application/ports/owned-feature-usage.reader.port.js";
import type { QuotaUsageReading } from "../../domain/entitlement.domain-service.js";

function toQuotaUsageReading(usage: DailySendUsage): QuotaUsageReading {
  return { used: usage.used, resetsAt: instantFromDate(usage.resetsAt) };
}

// social·planning 포트가 아직 Symbol 토큰이고 Date를 돌려줘 이 경계에서 바꾼다
@Injectable()
export class OwnedFeatureUsageReaderAdapter extends OwnedFeatureUsageReaderPort {
  readonly #cheerUsageReader: Pick<DailySendUsageReaderPort, "readDailyUsage">;
  readonly #nudgeUsageReader: Pick<DailySendUsageReaderPort, "readDailyUsage">;
  readonly #friendCountReader: Pick<FriendCountReaderPort, "countCurrentFriends">;
  readonly #categoryCountReader: Pick<TodoCategoryCountReaderPort, "countCategories">;

  constructor(
    @Inject(CHEER_USAGE_READER) cheerUsageReader: DailySendUsageReaderPort,
    @Inject(NUDGE_USAGE_READER) nudgeUsageReader: DailySendUsageReaderPort,
    @Inject(FRIEND_COUNT_READER) friendCountReader: FriendCountReaderPort,
    @Inject(TODO_CATEGORY_COUNT_READER) categoryCountReader: TodoCategoryCountReaderPort,
  ) {
    super();
    this.#cheerUsageReader = cheerUsageReader;
    this.#nudgeUsageReader = nudgeUsageReader;
    this.#friendCountReader = friendCountReader;
    this.#categoryCountReader = categoryCountReader;
  }

  async read(params: {
    readonly userId: UserId;
    readonly timeZone: string;
  }): Promise<OwnedFeatureUsage> {
    const userId = params.userId.value;
    const [cheer, nudge, friendCount, categoryCount] = await Promise.all([
      this.#cheerUsageReader.readDailyUsage(userId, params.timeZone),
      this.#nudgeUsageReader.readDailyUsage(userId, params.timeZone),
      this.#friendCountReader.countCurrentFriends(userId),
      this.#categoryCountReader.countCategories(userId),
    ]);
    return {
      daily: { CHEER: toQuotaUsageReading(cheer), NUDGE: toQuotaUsageReading(nudge) },
      resourceCounts: { FRIEND: friendCount, TODO_CATEGORY: categoryCount },
    };
  }
}
