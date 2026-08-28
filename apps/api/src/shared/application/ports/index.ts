/**
 * 공유 애플리케이션 포트 배럴 — 포트/불투명 타입만 공개합니다.
 *
 * Prisma 구조 타입(prisma.types)·select 상수(selects)는 인프라 계층
 * (@/shared/infrastructure/database)에 있습니다. application 계층의
 * Prisma 타입 누출 방지 — lint:boundaries가 검사.
 */
export * from "./domain-event-publisher.port";
export * from "./after-commit-task.registry.port";
export * from "./job-runtime.port";
export * from "./mutation-lock.port";
export * from "./unit-of-work.port";
