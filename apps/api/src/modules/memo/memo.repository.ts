import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { DatabaseService } from "@/database/database.service";
import type { Memo, Prisma } from "@/generated/prisma/client";
import type { FindMemosParams } from "./types";

@Injectable()
export class MemoRepository {
	constructor(
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
	) {}

	/** 활성 트랜잭션(없으면 베이스 클라이언트) */
	private get client() {
		return this.txHost.tx;
	}

	async create(data: Prisma.MemoCreateInput): Promise<Memo> {
		return this.client.memo.create({ data });
	}

	async findByIdAndUserId(id: number, userId: string): Promise<Memo | null> {
		return this.client.memo.findFirst({
			where: { id, userId },
		});
	}

	async findManyByUserId(params: FindMemosParams): Promise<Memo[]> {
		const { userId, cursor, size } = params;

		return this.client.memo.findMany({
			where: { userId },
			take: size + 1,
			...(cursor != null && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [{ isPinned: "desc" }, { sortOrder: "desc" }, { id: "desc" }],
		});
	}

	async countByUserId(userId: string): Promise<number> {
		return this.client.memo.count({ where: { userId } });
	}

	async update(id: number, data: Prisma.MemoUpdateInput): Promise<Memo> {
		return this.client.memo.update({
			where: { id },
			data,
		});
	}

	async delete(id: number): Promise<Memo> {
		return this.client.memo.delete({ where: { id } });
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
	): Promise<number> {
		const result = await this.client.memo.updateMany({
			where: {
				userId,
				sortOrder: {
					gte: fromSortOrder,
					...(toSortOrder !== null && { lte: toSortOrder }),
				},
			},
			data: { sortOrder: { increment: delta } },
		});
		return result.count;
	}

	async updateSortOrder(id: number, sortOrder: number): Promise<Memo> {
		return this.client.memo.update({
			where: { id },
			data: { sortOrder },
		});
	}
}
