import type { CacheStorePort } from "../cache-store.port.js";

/** 옛 토큰. CacheStorePort와 같은 인스턴스의 별칭이고 Context가 CacheStorePort로 옮기면 지운다. */
export const CACHE_SERVICE = Symbol("CACHE_SERVICE");

/** 옛 이름. CacheStorePort로 옮기면 지운다. */
export type ICacheService = CacheStorePort;
