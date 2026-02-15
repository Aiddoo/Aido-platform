import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import type { ILockProvider } from "../interfaces/lock.interface";

interface LockEntry {
	expiresAt: number;
}

/**
 * 인메모리 잠금 어댑터
 *
 * - Map 기반 저장소
 * - TTL 지원 (밀리초)
 * - 30초마다 만료된 항목 자동 정리
 * - 단일 프로세스 환경에서만 유효 (수평 확장 시 Redis 잠금 필요)
 */
@Injectable()
export class InMemoryLockAdapter implements ILockProvider, OnModuleDestroy {
	private readonly logger = new Logger(InMemoryLockAdapter.name);
	private readonly locks = new Map<string, LockEntry>();
	private readonly cleanupInterval: NodeJS.Timeout;

	constructor(config?: { cleanupIntervalMs?: number }) {
		const cleanupIntervalMs = config?.cleanupIntervalMs ?? 30_000;

		this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
	}

	onModuleDestroy(): void {
		clearInterval(this.cleanupInterval);
	}

	async acquire(
		resource: string,
		ttlMs: number,
	): Promise<(() => Promise<void>) | null> {
		const now = Date.now();
		const existing = this.locks.get(resource);

		// 이미 잠겨있고 아직 만료되지 않은 경우
		if (existing && now < existing.expiresAt) {
			this.logger.debug(`LOCK_BUSY ${resource}`);
			return null;
		}

		// 잠금 획득
		this.locks.set(resource, { expiresAt: now + ttlMs });
		this.logger.debug(`LOCK_ACQUIRED ${resource} (TTL: ${ttlMs}ms)`);

		// release 함수 반환
		const release = async (): Promise<void> => {
			this.locks.delete(resource);
			this.logger.debug(`LOCK_RELEASED ${resource}`);
		};

		return release;
	}

	async isLocked(resource: string): Promise<boolean> {
		const entry = this.locks.get(resource);

		if (!entry) {
			return false;
		}

		// 만료 체크
		if (Date.now() >= entry.expiresAt) {
			this.locks.delete(resource);
			return false;
		}

		return true;
	}

	// === Private 헬퍼 ===

	private cleanup(): void {
		const now = Date.now();
		let cleaned = 0;

		for (const [resource, entry] of this.locks.entries()) {
			if (now >= entry.expiresAt) {
				this.locks.delete(resource);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			this.logger.debug(`LOCK_CLEANUP ${cleaned} expired entries`);
		}
	}
}
