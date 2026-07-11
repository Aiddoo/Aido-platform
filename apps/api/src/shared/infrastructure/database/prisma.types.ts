/**
 * Prisma 관련 공통 타입 정의
 */
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 트랜잭션 클라이언트 타입
 *
 * 트랜잭션 내에서 사용할 수 있는 Prisma 클라이언트의 제한된 버전입니다.
 * 트랜잭션 관리 메서드들($connect, $disconnect 등)은 제외됩니다.
 *
 * @example
 * ```typescript
 * async create(data: CreateData, tx?: TransactionClient): Promise<Entity> {
 *   const client = tx ?? this.database;
 *   return client.entity.create({ data });
 * }
 * ```
 */
export type TransactionClient = Omit<
	PrismaClient,
	"$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;
