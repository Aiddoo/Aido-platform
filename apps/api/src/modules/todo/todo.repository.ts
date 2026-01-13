import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@/database";
import type { Prisma, Todo } from "@/generated/prisma/client";

@Injectable()
export class TodoRepository {
	constructor(private readonly database: DatabaseService) {}

	async findAll(): Promise<Todo[]> {
		return this.database.todo.findMany({ orderBy: { createdAt: "desc" } });
	}

	/**
	 * 오프셋 기반 페이지네이션 조회
	 */
	async findAllWithPagination(params: {
		skip: number;
		take: number;
	}): Promise<{ items: Todo[]; total: number }> {
		const [items, total] = await this.database.$transaction([
			this.database.todo.findMany({
				skip: params.skip,
				take: params.take,
				orderBy: { createdAt: "desc" },
			}),
			this.database.todo.count(),
		]);

		return { items, total };
	}

	/**
	 * 커서 기반 페이지네이션 조회
	 */
	async findAllWithCursor(params: {
		cursor?: string;
		take: number;
	}): Promise<Todo[]> {
		return this.database.todo.findMany({
			take: params.take,
			...(params.cursor && {
				skip: 1, // 커서 아이템 제외
				cursor: { id: params.cursor },
			}),
			orderBy: { id: "desc" },
		});
	}

	async findById(id: string): Promise<Todo | null> {
		return this.database.todo.findUnique({ where: { id } });
	}

	async create(data: Prisma.TodoUncheckedCreateInput): Promise<Todo> {
		return this.database.todo.create({ data });
	}

	async update(id: string, data: Prisma.TodoUpdateInput): Promise<Todo> {
		return this.database.todo.update({ where: { id }, data });
	}

	async delete(id: string): Promise<Todo> {
		return this.database.todo.delete({ where: { id } });
	}
}
