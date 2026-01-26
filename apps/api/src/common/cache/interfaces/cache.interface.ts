/**
 * 캐시 서비스 인터페이스
 *
 * Strategy Pattern + Dependency Injection으로 인메모리 ↔ Redis 전환 가능
 * Cacheable, @nestjs/cache-manager 등 인기 라이브러리 패턴 참고
 */

export const CACHE_SERVICE = Symbol("CACHE_SERVICE");

/**
 * TTL Shorthand 타입 (Cacheable 패턴)
 * 숫자(밀리초) 또는 문자열 형식 지원
 *
 * @example
 * '30s' // 30초
 * '5m'  // 5분
 * '1h'  // 1시간
 * '1d'  // 1일
 * 60000 // 60초 (밀리초)
 */
export type TtlValue = number | `${number}${"s" | "m" | "h" | "d"}`;

/**
 * TTL Shorthand 문자열을 밀리초로 변환
 *
 * @param ttl TTL 값 (숫자 또는 shorthand 문자열)
 * @returns 밀리초 단위의 TTL
 * @throws Invalid TTL format 에러
 *
 * @example
 * parseTtl('30s') // 30000
 * parseTtl('5m')  // 300000
 * parseTtl('1h')  // 3600000
 * parseTtl('1d')  // 86400000
 * parseTtl(60000) // 60000
 */
export function parseTtl(ttl: TtlValue): number {
	if (typeof ttl === "number") return ttl;

	const match = ttl.match(/^(\d+)(s|m|h|d)$/);
	if (!match) throw new Error(`Invalid TTL format: ${ttl}`);

	const value = match[1] as string;
	const unit = match[2] as "s" | "m" | "h" | "d";
	const multipliers: Record<"s" | "m" | "h" | "d", number> = {
		s: 1000,
		m: 60 * 1000,
		h: 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
	};

	return Number.parseInt(value, 10) * multipliers[unit];
}

export interface ICacheService {
	/**
	 * 캐시에서 값 조회
	 * @returns 캐시 미스 시 undefined
	 */
	get<T>(key: string): Promise<T | undefined>;

	/**
	 * 캐시에 값 저장
	 * @param ttl TTL (밀리초 또는 shorthand), undefined면 기본값 사용
	 */
	set<T>(key: string, value: T, ttl?: TtlValue): Promise<void>;

	/**
	 * 캐시에서 값 삭제
	 */
	del(key: string): Promise<void>;

	/**
	 * 패턴에 매칭되는 모든 키 삭제
	 * @param pattern 와일드카드 패턴 (예: "user:*")
	 * @returns 삭제된 키 개수
	 *
	 * Redis: SCAN 명령 사용 (논블로킹)
	 */
	delByPattern(pattern: string): Promise<number>;

	/**
	 * 캐시 전체 초기화
	 */
	reset(): Promise<void>;

	/**
	 * 캐시 통계 조회 (모니터링용)
	 */
	getStats(): CacheStats;

	// === 새로운 메서드 (Cacheable 패턴) ===

	/**
	 * 캐시-aside 패턴 자동화 (wrap)
	 *
	 * 1. 캐시 히트 → 캐시된 값 반환
	 * 2. 캐시 미스 → factory 호출 → 결과 캐싱 → 반환
	 *
	 * @param key 캐시 키
	 * @param factory 캐시 미스 시 호출될 함수
	 * @param ttl TTL (선택)
	 * @returns factory 결과 또는 캐시된 값
	 *
	 * Redis: GET + SET (atomic하지 않음, 필요시 Lua 스크립트 사용)
	 *
	 * @example
	 * const user = await cache.wrap(
	 *   `user:${userId}`,
	 *   () => userRepository.findById(userId),
	 *   '5m'
	 * );
	 */
	wrap<T>(key: string, factory: () => Promise<T>, ttl?: TtlValue): Promise<T>;

	/**
	 * 다중 키 조회 (배치)
	 * @param keys 조회할 키 배열
	 * @returns 값 배열 (미스는 undefined)
	 *
	 * Redis: MGET 명령
	 */
	mget<T>(keys: string[]): Promise<(T | undefined)[]>;

	/**
	 * 다중 키 저장 (배치)
	 * @param entries 저장할 엔트리 배열
	 *
	 * Redis: Pipeline SET
	 */
	mset<T>(
		entries: Array<{ key: string; value: T; ttl?: TtlValue }>,
	): Promise<void>;

	/**
	 * 키 존재 여부 확인 (값 조회 없이)
	 * @param key 캐시 키
	 * @returns 존재 여부
	 *
	 * Redis: EXISTS 명령
	 */
	has(key: string): Promise<boolean>;

	/**
	 * 남은 TTL 조회
	 * @param key 캐시 키
	 * @returns 남은 TTL (밀리초), -1: TTL 없음, -2: 키 없음
	 *
	 * Redis: PTTL 명령
	 */
	ttl(key: string): Promise<number>;

	/**
	 * TTL 갱신 (값 변경 없이)
	 * @param key 캐시 키
	 * @param ttl 새 TTL
	 * @returns 성공 여부 (키가 없으면 false)
	 *
	 * Redis: PEXPIRE 명령
	 */
	touch(key: string, ttl: TtlValue): Promise<boolean>;
}

export interface CacheStats {
	hits: number;
	misses: number;
	keys: number;
	memoryUsage?: number; // bytes (인메모리 전용)
}

export interface CacheConfig {
	type: "memory" | "redis";
	defaultTtlMs: number;
	maxItems: number;
	redis?: RedisConfig;
}

export interface RedisConfig {
	host: string;
	port: number;
	password?: string;
	db?: number;
	/** 키 프리픽스 (기본값: 'aido:') */
	keyPrefix?: string;
	/** 연결 타임아웃 (밀리초) */
	connectTimeout?: number;
	/** 명령 타임아웃 (밀리초) */
	commandTimeout?: number;
}
