/**
 * 공유 애플리케이션 포트 배럴 — 포트/불투명 타입만 공개합니다.
 *
 * ORM 구조 타입(database.types)·select 상수(selects)는 인프라 계층
 * (@/shared/infrastructure/database)에 있습니다. application 계층의
 * Prisma 타입 누출 방지 — lint:boundaries가 검사.
 */
export * from "./after-commit-task.registry.port.js";
export * from "./domain-event-publisher.port.js";
export * from "./job-runtime.port.js";
export * from "./mutation-lock.port.js";
export * from "./unit-of-work.port.js";
