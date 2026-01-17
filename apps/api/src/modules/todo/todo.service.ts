import { Injectable, Logger } from "@nestjs/common";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
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
	private readonly logger = new Logger(TodoService.name);

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

	async findById(id: string) {
		const todo = await this.todoRepository.findById(id);
		if (!todo) throw BusinessExceptions.todoNotFound(id);
		return todo;
	}

	async create(userId: string, dto: CreateTodoDto) {
		const todo = await this.todoRepository.create({
			userId,
			title: dto.title,
			content: dto.content,
			color: dto.color,
			startDate: dto.startDate,
			endDate: dto.endDate,
			scheduledTime: dto.scheduledTime,
			isAllDay: dto.isAllDay,
			visibility: dto.visibility,
		});

		this.logger.log(`할 일 생성 완료: todoId=${todo.id}, userId=${userId}`);
		return todo;
	}

	async update(id: string, dto: UpdateTodoDto) {
		await this.findById(id);
		const todo = await this.todoRepository.update(id, dto);

		this.logger.log(`할 일 수정 완료: todoId=${id}`);
		return todo;
	}

	async delete(id: string) {
		await this.findById(id);
		const deletedTodo = await this.todoRepository.delete(id);

		this.logger.log(`할 일 삭제 완료: todoId=${id}`);
		return deletedTodo;
	}
}
