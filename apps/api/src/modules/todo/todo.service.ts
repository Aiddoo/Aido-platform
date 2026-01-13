import { Injectable, NotFoundException } from "@nestjs/common";
import type {
	CursorPaginatedResponse,
	CursorPaginationParams,
	NormalizedPagination,
	PaginatedResponse,
} from "@/common/pagination";
import { PaginationService } from "@/common/pagination";
import type { Todo } from "@/generated/prisma/client";
import type { CreateTodoDto, UpdateTodoDto } from "./dtos/request";
import { TodoRepository } from "./todo.repository";

@Injectable()
export class TodoService {
	constructor(
		private readonly todoRepository: TodoRepository,
		private readonly paginationService: PaginationService,
	) {}

	async findAll() {
		return this.todoRepository.findAll();
	}

	/**
	 * 오프셋 기반 페이지네이션 조회
	 */
	async findAllPaginated(
		params: NormalizedPagination,
	): Promise<PaginatedResponse<Todo>> {
		const { items, total } = await this.todoRepository.findAllWithPagination({
			skip: params.skip,
			take: params.take,
		});

		return this.paginationService.createPaginatedResponse({
			items,
			page: params.page,
			size: params.size,
			total,
		});
	}

	/**
	 * 커서 기반 페이지네이션 조회
	 */
	async findAllWithCursor(
		params: CursorPaginationParams,
	): Promise<CursorPaginatedResponse<Todo>> {
		const { cursor, size, take } =
			this.paginationService.normalizeCursorPagination(params);

		const items = await this.todoRepository.findAllWithCursor({
			cursor,
			take,
		});

		return this.paginationService.createCursorPaginatedResponse({
			items,
			size,
			cursor,
		});
	}

	async findById(id: number) {
		const todo = await this.todoRepository.findById(id);
		if (!todo) throw new NotFoundException(`Todo #${id} not found`);
		return todo;
	}

	async create(dto: CreateTodoDto) {
		return this.todoRepository.create(dto);
	}

	async update(id: number, dto: UpdateTodoDto) {
		await this.findById(id);
		return this.todoRepository.update(id, dto);
	}

	async delete(id: number) {
		await this.findById(id);
		return this.todoRepository.delete(id);
	}
}
