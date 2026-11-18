import { Injectable } from "@nestjs/common";

import { DailyCompletionCache } from "#api/modules/insights/daily-completions/infrastructure/cache/daily-completion.cache";
import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 실제 캐시를 그대로 쓰고 커밋 뒤 구독이 지운 사용자를 순서대로 남긴다
@Injectable()
export class CountingDailyCompletionCache extends DailyCompletionCache {
  readonly invalidatedUserIds: string[] = [];

  constructor(store: CacheStorePort) {
    super(store);
  }

  override async invalidate(userId: UserId): Promise<void> {
    this.invalidatedUserIds.push(userId.value);
    await super.invalidate(userId);
  }
}
