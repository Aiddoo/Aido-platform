import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@/database/database.service";
import type { Memo, Prisma } from "@/generated/prisma/client";
import type { FindMemosParams, TransactionClient } from "./types";

@Injectable()
export class MemoRepository {
	constructor(private readonly database: DatabaseService) {}

	async create(
		data: Prisma.MemoCreateInput,
		tx?: TransactionClient,
	): Promise<Memo> {
		const client = tx ?? this.database;
		return client.memo.create({ data });
	}

	async findByIdAndUserId(
		id: number,
		userId: string,
		tx?: TransactionClient,
	): Promise<Memo | null> {
		const client = tx ?? this.database;
		return client.memo.findFirst({
			where: { id, userId },
		});
	}

	async findManyByUserId(
		params: FindMemosParams,
		tx?: TransactionClient,
	): Promise<Memo[]> {
		const { userId, cursor, size } = params;
		const client = tx ?? this.database;

		return client.memo.findMany({
			where: { userId },
			take: size + 1,
			...(cursor != null && {
				skip: 1,
				cursor: { id: cursor },
			}),
			orderBy: [{ isPinned: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
		});
	}

	async countByUserId(userId: string, tx?: TransactionClient): Promise<number> {
		const client = tx ?? this.database;
		return client.memo.count({ where: { userId } });
	}

	async update(
		id: number,
		data: Prisma.MemoUpdateInput,
		tx?: TransactionClient,
	): Promise<Memo> {
		const client = tx ?? this.database;
		return client.memo.update({
			where: { id },
			data,
		});
	}

	async delete(id: number, tx?: TransactionClient): Promise<Memo> {
		const client = tx ?? this.database;
		return client.memo.delete({ where: { id } });
	}

	async getMaxSortOrder(
		userId: string,
		tx?: TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		const result = await client.memo.aggregate({
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
		tx?: TransactionClient,
	): Promise<number> {
		const client = tx ?? this.database;
		const result = await client.memo.updateMany({
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

	async updateSortOrder(
		id: number,
		sortOrder: number,
		tx?: TransactionClient,
	): Promise<Memo> {
		const client = tx ?? this.database;
		return client.memo.update({
			where: { id },
			data: { sortOrder },
		});
	}
}
