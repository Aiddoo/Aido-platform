/**
 * database 공용 배럴 — 포트/불투명 타입만 공개합니다.
 *
 * Prisma 구조 타입(prisma.types)·select 상수(selects)는 의도적으로 재수출하지
 * 않습니다. 인프라·레거시 계층은 직접 경로로 임포트하세요.
 * (application 계층의 Prisma 타입 누출 방지 — lint:boundaries가 검사)
 */
export * from "./transaction-context";
export * from "./transaction-manager.port";
export * from "./unit-of-work.port";
export * from "./utils/batch-cursor.util";
