import type { TransactionClient } from "@/shared/infrastructure/database/prisma.types";

declare const TRANSACTION_CONTEXT_BRAND: unique symbol;

/**
 * 불투명 트랜잭션 컨텍스트
 *
 * application 계층(포트·유스케이스)이 Prisma 구조 타입(TransactionClient)에
 * 노출되지 않도록 트랜잭션 핸들을 브랜드 타입으로 감쌉니다.
 * 실제 값은 Prisma 트랜잭션 클라이언트이며, 인프라 계층만
 * `unwrapTransaction`으로 되돌려 사용합니다.
 */
export interface TransactionContext {
	readonly [TRANSACTION_CONTEXT_BRAND]: never;
}

/**
 * Prisma 트랜잭션 클라이언트를 불투명 컨텍스트로 래핑합니다.
 * (트랜잭션 매니저 구현체·테스트 목 전용)
 */
export function wrapTransaction(client: TransactionClient): TransactionContext {
	return client as unknown as TransactionContext;
}

/**
 * 불투명 컨텍스트를 Prisma 트랜잭션 클라이언트로 되돌립니다.
 * (인프라 어댑터 전용 — 여기 단일 지점에만 캐스트를 격리합니다)
 */
export function unwrapTransaction(ctx: TransactionContext): TransactionClient {
	return ctx as unknown as TransactionClient;
}
