import { Inject, Injectable } from "@nestjs/common";

import { TodoCategoryCountReaderPort } from "#api/modules/planning/categories/planning-categories.public";
import {
  CheerUsageReaderPort,
  type DailySendUsage,
  type DailySendUsageReaderPort,
} from "#api/modules/social/cheers/social-cheers.public";
import { FriendCountReaderPort } from "#api/modules/social/friends/social-friends.public";
import { NudgeUsageReaderPort } from "#api/modules/social/nudges/social-nudges.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";

import type { QuotaUsageReading } from "../../../shared/domain/entitlement.domain-service.js";
import {
  OwnedFeatureUsageReaderPort,
  type OwnedFeatureUsage,
} from "../../application/ports/owned-feature-usage.reader.port.js";

function toQuotaUsageReading(usage: DailySendUsage): QuotaUsageReading {
  return { used: usage.used, resetsAt: instantFromDate(usage.resetsAt) };
}

// social·planning 포트가 Date를 돌려줘 이 경계에서 Temporal로 바꾼다
@Injectable()
export class OwnedFeatureUsageReaderAdapter implements OwnedFeatureUsageReaderPort {
  readonly #cheerUsageReader: Pick<DailySendUsageReaderPort, "readDailyUsage">;
  readonly #nudgeUsageReader: Pick<DailySendUsageReaderPort, "readDailyUsage">;
  readonly #friendCountReader: Pick<FriendCountReaderPort, "countCurrentFriends">;
  readonly #categoryCountReader: Pick<TodoCategoryCountReaderPort, "countCategories">;

  constructor(
    @Inject(CheerUsageReaderPort) cheerUsageReader: CheerUsageReaderPort,
    @Inject(NudgeUsageReaderPort) nudgeUsageReader: NudgeUsageReaderPort,
    @Inject(FriendCountReaderPort) friendCountReader: FriendCountReaderPort,
    @Inject(TodoCategoryCountReaderPort) categoryCountReader: TodoCategoryCountReaderPort,
  ) {
    this.#cheerUsageReader = cheerUsageReader;
    this.#nudgeUsageReader = nudgeUsageReader;
    this.#friendCountReader = friendCountReader;
    this.#categoryCountReader = categoryCountReader;
  }

  async read(params: {
    readonly userId: UserId;
    readonly timeZone: string;
  }): Promise<OwnedFeatureUsage> {
    const [cheer, nudge, friendCount, categoryCount] = await Promise.all([
      this.#cheerUsageReader.readDailyUsage(params.userId, params.timeZone),
      this.#nudgeUsageReader.readDailyUsage(params.userId, params.timeZone),
      this.#friendCountReader.countCurrentFriends(params.userId),
      this.#categoryCountReader.countCategories(params.userId),
    ]);
    return {
      daily: { CHEER: toQuotaUsageReading(cheer), NUDGE: toQuotaUsageReading(nudge) },
      resourceCounts: { FRIEND: friendCount, TODO_CATEGORY: categoryCount },
    };
  }
}
