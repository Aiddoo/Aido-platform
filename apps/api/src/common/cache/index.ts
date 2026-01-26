/**
 * Cache 모듈 Barrel Export
 *
 * 캐시 추상화 레이어를 위한 모든 공개 API를 내보냅니다.
 * - Strategy Pattern + Dependency Injection으로 인메모리 ↔ Redis 무중단 전환 가능
 */

// Adapters
export * from "./adapters/in-memory-cache.adapter";
export * from "./adapters/redis-cache.adapter";
// Module & Service
export * from "./cache.module";
export * from "./cache.service";
// Constants
export * from "./constants/cache-keys";
// Interfaces
export * from "./interfaces/cache.interface";
