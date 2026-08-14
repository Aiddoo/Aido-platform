import { Injectable } from "@nestjs/common";

import { CacheService } from "@/shared/infrastructure/cache/cache.service";

import type { UserSettingsCachePort } from "../../application/ports/user-settings-cache.port";
import type { PreferenceSnapshot } from "../../domain/services/preference-view";

/**
 * UserSettingsCachePort의 어댑터 — 공유 CacheService(중앙 관리 CacheKeys)에 위임한다.
 * 키 관리·TTL·직렬화는 CacheService/CacheKeys가 소유하고, 이 어댑터는 설정 캐시
 * 시맨틱만 노출한다.
 */
@Injectable()
export class UserSettingsCacheAdapter implements UserSettingsCachePort {
	constructor(private readonly cacheService: CacheService) {}

	wrapUserPreference(
		userId: string,
		factory: () => Promise<PreferenceSnapshot>,
	): Promise<PreferenceSnapshot> {
		return this.cacheService.wrapUserPreference(userId, factory);
	}

	invalidateUserPreference(userId: string): Promise<void> {
		return this.cacheService.invalidateUserPreference(userId);
	}

	invalidateActiveTimezones(): Promise<void> {
		return this.cacheService.invalidateActiveTimezones();
	}
}
