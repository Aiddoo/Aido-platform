import {
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import type { IDedupProvider } from "../interfaces/dedup.interface";

interface DedupEntry {
	members: Set<string>;
	expiresAt: number;
}

/**
 * 인메모리 중복 방지 어댑터
 *
 * - Map<string, Set> 기반 저장소
 * - TTL 지원 (밀리초)
 * - 60초마다 만료된 항목 자동 정리
 * - 단일 프로세스 환경에서만 유효 (수평 확장 시 Redis 필요)
 */
@Injectable()
export class InMemoryDedupAdapter
	implements IDedupProvider, OnModuleDestroy, OnModuleInit
{
	readonly #logger = new Logger(InMemoryDedupAdapter.name);
	readonly #sets = new Map<string, DedupEntry>();
	#cleanupInterval: NodeJS.Timeout | undefined;

	onModuleInit(): void {
		this.#cleanupInterval = setInterval(() => this.#cleanup(), 60_000);
		this.#logger.warn(
			"Using in-memory dedup provider — SINGLE INSTANCE ONLY. " +
				"Set CACHE_TYPE=redis for multi-instance deployments.",
		);
	}

	onModuleDestroy(): void {
		clearInterval(this.#cleanupInterval);
	}

	async filterMembers(setKey: string, members: string[]): Promise<Set<string>> {
		const entry = this.#getValid(setKey);
		if (!entry) return new Set();
		return new Set(members.filter((m) => entry.members.has(m)));
	}

	async isMember(setKey: string, member: string): Promise<boolean> {
		return this.#getValid(setKey)?.members.has(member) ?? false;
	}

	async addMembers(
		setKey: string,
		members: string[],
		ttlMs: number,
	): Promise<void> {
		if (members.length === 0) return;

		let entry = this.#getValid(setKey);
		if (!entry) {
			entry = { members: new Set(), expiresAt: Date.now() + ttlMs };
			this.#sets.set(setKey, entry);
		}
		for (const m of members) entry.members.add(m);
		entry.expiresAt = Date.now() + ttlMs;
	}

	// === Private 헬퍼 ===
	#getValid(key: string): DedupEntry | undefined {
		const entry = this.#sets.get(key);
		if (!entry) return undefined;

		if (Date.now() > entry.expiresAt) {
			this.#sets.delete(key);
			return undefined;
		}

		return entry;
	}

	#cleanup(): void {
		const now = Date.now();
		let cleaned = 0;

		for (const [key, entry] of this.#sets) {
			if (now > entry.expiresAt) {
				this.#sets.delete(key);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			this.#logger.debug(`DEDUP_CLEANUP ${cleaned} expired entries`);
		}
	}
}
