import type { RedisOptions } from "ioredis";

/**
 * Redis 연결 설정 (config.service의 redisUrl/redis getter에서 조립)
 */
export interface RedisConnectionSettings {
	/** REDIS_URL — 존재하면 host/port/password/db보다 우선 */
	url?: string;
	host?: string;
	port?: number;
	password?: string;
	db?: number;
	/** 연결 수립 타임아웃 (명령용 클라이언트에만 적용) */
	connectTimeoutMs: number;
	/** 명령 응답 타임아웃 (명령용 클라이언트에만 적용) */
	commandTimeoutMs: number;
}

/**
 * BullMQ 전용 클라이언트 옵션
 *
 * BullMQ는 블로킹 명령(BRPOPLPUSH 등)을 사용하므로:
 * - `maxRetriesPerRequest: null` 필수 (BullMQ 요구사항 — 절대 변경 금지)
 * - `commandTimeout`/`enableOfflineQueue: false`를 적용하면 안 됨
 *   (블로킹 대기가 타임아웃으로 끊기거나 재연결 중 잡이 유실됨)
 */
export function buildBullRedisOptions(settings: RedisConnectionSettings): RedisOptions {
	return {
		...baseHostOptions(settings),
		// ioredis 6은 RESP3가 기본이지만 기존 Redis/BullMQ wire contract를
		// 유지해 rolling deployment 중 protocol 차이를 만들지 않는다.
		protocol: 2,
		maxRetriesPerRequest: null,
		enableReadyCheck: true,
		connectionName: "aido-main",
	};
}

/**
 * 명령용(캐시/락/스로틀/dedup/헬스) 클라이언트 옵션 — fail-fast
 *
 * Redis 단절 시 명령이 오프라인 큐에서 무한 대기하지 않고 즉시 reject되어
 * 소비처의 fail-open/fail-closed 처리가 작동하도록 한다:
 * - `enableOfflineQueue: false`: 단절 중 명령 즉시 reject (핵심)
 * - `commandTimeout`: 연결은 살아있는데 응답이 없는 blackhole 상황 상한
 * - `maxRetriesPerRequest: 1`: 재연결 후 1회만 재시도
 *
 * retryStrategy는 ioredis 기본값 유지 — 백그라운드 자동 재접속이
 * half-open probe 역할을 하므로 복구 시 별도 조치 없이 정상화된다.
 */
export function buildCommandRedisOptions(settings: RedisConnectionSettings): RedisOptions {
	return {
		...baseHostOptions(settings),
		// 캐시·락·스로틀의 응답 shape를 v5와 동일하게 유지한다.
		protocol: 2,
		maxRetriesPerRequest: 1,
		enableOfflineQueue: false,
		commandTimeout: settings.commandTimeoutMs,
		connectTimeout: settings.connectTimeoutMs,
		enableReadyCheck: true,
		connectionName: "aido-command",
	};
}

function baseHostOptions(settings: RedisConnectionSettings): RedisOptions {
	if (settings.url) {
		return {};
	}

	return {
		host: settings.host ?? "localhost",
		port: settings.port ?? 6379,
		password: settings.password,
		db: settings.db ?? 0,
	};
}
