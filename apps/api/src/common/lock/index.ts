/**
 * Lock 모듈 Barrel Export
 *
 * 분산 잠금 추상화 레이어를 위한 모든 공개 API를 내보냅니다.
 * - Strategy Pattern + Dependency Injection으로 인메모리 ↔ Redis 무중단 전환 가능
 */

// Adapters
export * from "./adapters/in-memory-lock.adapter";
// Interfaces
export * from "./interfaces/lock.interface";
// Module
export * from "./lock.module";
