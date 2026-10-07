import { Inject, Injectable } from "@nestjs/common";

import {
  CACHE_SERVICE,
  type CacheStats,
  type ICacheService,
  type TtlValue,
} from "./interfaces/cache.interface.js";

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_SERVICE) private readonly cache: ICacheService) {}

  get<T>(key: string): Promise<T | undefined> {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttl?: TtlValue): Promise<void> {
    return this.cache.set(key, value, ttl);
  }

  del(key: string): Promise<void> {
    return this.cache.del(key);
  }

  delByPattern(pattern: string): Promise<number> {
    return this.cache.delByPattern(pattern);
  }

  reset(): Promise<void> {
    return this.cache.reset();
  }

  getStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Cache-aside 패턴 (wrap)
   *
   * 캐시에 데이터가 있으면 반환, 없으면 factory 실행 후 캐싱
   */
  wrap<T>(key: string, factory: () => Promise<T>, ttl?: TtlValue): Promise<T> {
    return this.cache.wrap(key, factory, ttl);
  }

  mget<T>(keys: string[]): Promise<(T | undefined)[]> {
    return this.cache.mget<T>(keys);
  }

  mset<T>(entries: Array<{ key: string; value: T; ttl?: TtlValue }>): Promise<void> {
    return this.cache.mset(entries);
  }

  has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  /**
   * 키의 남은 TTL 조회 (밀리초)
   *
   * @returns 남은 밀리초, -1 (TTL 없음), -2 (키 없음)
   */
  ttl(key: string): Promise<number> {
    return this.cache.ttl(key);
  }

  /**
   * 키의 TTL 갱신
   *
   * @returns 성공 시 true, 키가 없으면 false
   */
  touch(key: string, ttl: TtlValue): Promise<boolean> {
    return this.cache.touch(key, ttl);
  }
}
