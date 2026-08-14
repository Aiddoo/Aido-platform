import { Inject, Injectable } from "@nestjs/common";
import { cacheKey } from "@/shared/infrastructure/cache";
import {
	type ILockProvider,
	LOCK_PROVIDER,
} from "@/shared/infrastructure/lock";
import type { NotificationDedupLockPort } from "../../application/ports/notification-dedup.port";
import { DEDUP_LOCK_TTL } from "../../domain/services/notification-dedup";

/** 알림 중복 잠금의 Redis keyspace와 TTL을 소유한다. */
@Injectable()
export class NotificationDedupLockAdapter implements NotificationDedupLockPort {
	constructor(
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
	) {}

	acquire(dedupKey: string): Promise<(() => Promise<void>) | null> {
		return this.lockProvider.acquire(
			cacheKey("notification", "lock-dedup", dedupKey),
			DEDUP_LOCK_TTL,
		);
	}
}
