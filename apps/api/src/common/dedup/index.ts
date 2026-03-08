/**
 * Dedup 모듈 Barrel Export
 *
 * 중복 방지 추상화 레이어를 위한 모든 공개 API를 내보냅니다.
 * - Strategy Pattern + Dependency Injection으로 인메모리 ↔ Redis 무중단 전환 가능
 */

// Adapters
export * from "./adapters/in-memory-dedup.adapter";
export * from "./adapters/redis-dedup.adapter";
// Constants
export * from "./constants/dedup-keys";
// Module
export * from "./dedup.module";
// Interfaces
export * from "./interfaces/dedup.interface";
