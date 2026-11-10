import type { z } from "zod";

/**
 * 캐시는 직렬화 경계(Redis JSON)이자 이전 배포가 남긴 값이 섞이는 저장소다.
 * 읽기는 소비처 스키마로 다시 검증하고, 형태가 다르면 미스로 취급한다.
 * JSON에서 문자열이 되는 날짜는 `z.coerce.date()`로 복원한다.
 */
export type CacheValueSchema<T> = z.ZodType<T>;

/** 값을 받은 뒤에 보관 시간을 정해야 할 때(예: 곧 비가 오면 더 짧게) 함수로 넘긴다. */
export type CacheWrapTtlMs<T> = number | ((value: T) => number);

export interface CacheEntry<T> {
  readonly key: string;
  readonly value: T;
  readonly ttlMs?: number;
}

export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  /** 저장소가 셀 수 없으면(Redis) -1 */
  readonly keys: number;
}

export function resolveWrapTtlMs<T>(
  ttlMs: CacheWrapTtlMs<T> | undefined,
  value: T,
): number | undefined {
  return typeof ttlMs === "function" ? ttlMs(value) : ttlMs;
}

/**
 * 범용 캐시 저장소. TTL은 밀리초 숫자이고 생략하면 `CACHE_DEFAULT_TTL_MS`, 0이면 저장하지 않는다.
 *
 * 장애 계약(fail-open): 읽기(get·mget·has·ttl·touch)는 백엔드 장애 때 미스와 같고
 * (undefined·false·-2), 쓰기(set·mset·del·delByPattern·reset)는 던지지 않는다. TTL이 낡은 값의 상한이다.
 * 모든 구현은 `test/contracts/platform/cache-store.contract.ts`를 통과해야 한다.
 */
export abstract class CacheStorePort {
  abstract get<T>(key: string, schema: CacheValueSchema<T>): Promise<T | undefined>;
  abstract set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  abstract del(key: string): Promise<void>;
  abstract mget<T>(
    keys: readonly string[],
    schema: CacheValueSchema<T>,
  ): Promise<(T | undefined)[]>;
  abstract mset<T>(entries: readonly CacheEntry<T>[]): Promise<void>;
  /** `*` 와일드카드 패턴과 맞는 키를 지우고 지운 개수를 돌려준다. Redis는 SCAN으로 지운다. */
  abstract delByPattern(pattern: string): Promise<number>;
  /** 미스면 factory 결과를 저장해 돌려준다. 같은 key의 동시 미스는 factory를 한 번만 부른다. */
  abstract wrap<T>(
    key: string,
    schema: CacheValueSchema<T>,
    factory: () => Promise<T>,
    ttlMs?: CacheWrapTtlMs<T>,
  ): Promise<T>;
  abstract has(key: string): Promise<boolean>;
  /** 남은 밀리초. 키가 없으면 -2(Redis PTTL 규칙) */
  abstract ttl(key: string): Promise<number>;
  /** 값을 두고 TTL만 바꾼다. 키가 없으면 false */
  abstract touch(key: string, ttlMs: number): Promise<boolean>;
  abstract reset(): Promise<void>;
  abstract getStats(): CacheStats;
}
