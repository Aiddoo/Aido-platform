import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { Memo as MemoRow } from "@/generated/prisma/client";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import type {
	FindMemosParams,
	MemoRepositoryPort,
} from "../../application/ports/memo.repository.port";
import { Memo } from "../../domain/entities/memo.aggregate";

/**
 * MemoRepositoryPort의 Prisma 어댑터.
 *
 * Prisma Memo 행을 도메인 애그리게잇으로 매핑한다. 트랜잭션은 CLS로 전파된다 —
 * TransactionHost.tx가 활성 트랜잭션(없으면 베이스)을 반환한다.
 */
@Injectable()
export class PrismaMemoRepository implements MemoRepositoryPort {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	private get client() {
		return this.txHost.tx;
	}

	private static toDomain(row: MemoRow): Memo {
		return Memo.reconstitute({
			id: row.id,
			userId: row.userId,
			content: row.content,
			isPinned: row.isPinned,
			sortOrder: row.sortOrder,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}

	async create(
		userId: string,
		content: string,
		sortOrder: number,
	): Promise<Memo> {
		const row = await this.client.memo.create({
			data: { user: { connect: { id: userId } }, content, sortOrder },
		});
		return PrismaMemoRepository.toDomain(row);
	}

	async findByIdAndUserId(
		memoId: number,
		userId: string,
	): Promise<Memo | null> {
		const row = await this.client.memo.findFirst({
			where: { id: memoId, userId },
		});
		return row ? PrismaMemoRepository.toDomain(row) : null;
	}

	async findManyByUserId(params: FindMemosParams): Promise<Memo[]> {
		const { userId, cursor, size } = params;

		const rows = await this.client.memo.findMany({
			where: { userId },
			take: size + 1,
			...(cursor != null && { skip: 1, cursor: { id: cursor } }),
			orderBy: [{ isPinned: "desc" }, { sortOrder: "desc" }, { id: "desc" }],
		});
		return rows.map((row) => PrismaMemoRepository.toDomain(row));
	}

	async countByUserId(userId: string): Promise<number> {
		return this.client.memo.count({ where: { userId } });
	}

	async updateContent(memoId: number, content: string): Promise<Memo> {
		const row = await this.client.memo.update({
			where: { id: memoId },
			data: { content },
		});
		return PrismaMemoRepository.toDomain(row);
	}

	async updatePinned(memoId: number, isPinned: boolean): Promise<Memo> {
		const row = await this.client.memo.update({
			where: { id: memoId },
			data: { isPinned },
		});
		return PrismaMemoRepository.toDomain(row);
	}

	async updateSortOrder(memoId: number, sortOrder: number): Promise<Memo> {
		const row = await this.client.memo.update({
			where: { id: memoId },
			data: { sortOrder },
		});
		return PrismaMemoRepository.toDomain(row);
	}

	async getMaxSortOrder(userId: string): Promise<number> {
		const result = await this.client.memo.aggregate({
			where: { userId },
			_max: { sortOrder: true },
		});
		return result._max.sortOrder ?? -1;
	}

	async shiftSortOrders(
		userId: string,
		fromSortOrder: number,
		toSortOrder: number | null,
		delta: number,
	): Promise<void> {
		await this.client.memo.updateMany({
			where: {
				userId,
				sortOrder: {
					gte: fromSortOrder,
					...(toSortOrder !== null && { lte: toSortOrder }),
				},
			},
			data: { sortOrder: { increment: delta } },
		});
	}

	async delete(memoId: number): Promise<void> {
		await this.client.memo.delete({ where: { id: memoId } });
	}
}
