import {
	MEMO_LIMITS,
	type Memo as MemoResponse,
	type Todo,
} from "@aido/validators";
import { Injectable, Logger } from "@nestjs/common";
import type { TransactionClient } from "@/common/database";
import { toDateString } from "@/common/date/utils/format";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";
import type { CursorPaginatedResponse } from "@/common/pagination";
import { PaginationService } from "@/common/pagination";
import { DatabaseService } from "@/database/database.service";
import { TodoService } from "../todo/todo.service";
import { MemoMapper } from "./memo.mapper";
import { MemoRepository } from "./memo.repository";
import type {
	ConvertMemoToTodoData,
	ConvertMemoToTodosData,
	CreateMemoData,
	UpdateMemoData,
} from "./types";

@Injectable()
export class MemoService {
	readonly #logger = new Logger(MemoService.name);

	constructor(
		private readonly memoRepository: MemoRepository,
		private readonly paginationService: PaginationService,
		private readonly database: DatabaseService,
		private readonly todoService: TodoService,
	) {}

	/**
	 * 메모 생성
	 */
	async create(
		data: CreateMemoData,
	): Promise<{ message: string; memo: MemoResponse }> {
		// TX 내에서 제한 체크 + sortOrder 결정 + 생성 (race condition 방지)
		const memo = await this.database.$transaction(async (tx) => {
			const count = await this.memoRepository.countByUserId(data.userId, tx);
			if (count >= MEMO_LIMITS.MAX_PER_USER) {
				throw BusinessExceptions.memoLimitExceeded(
					count,
					MEMO_LIMITS.MAX_PER_USER,
				);
			}

			const maxSortOrder = await this.memoRepository.getMaxSortOrder(
				data.userId,
				tx,
			);

			return this.memoRepository.create(
				{
					user: { connect: { id: data.userId } },
					content: data.content,
					sortOrder: maxSortOrder + 1,
				},
				tx,
			);
		});

		this.#logger.log(`Memo created: ${memo.id} for user: ${data.userId}`);

		return {
			message: "메모가 생성되었습니다.",
			memo: MemoMapper.toResponse(memo),
		};
	}

	/**
	 * 메모 단일 조회
	 */
	async findOne(
		userId: string,
		memoId: number,
	): Promise<{ memo: MemoResponse }> {
		const memo = await this.memoRepository.findByIdAndUserId(memoId, userId);
		if (!memo) {
			throw BusinessExceptions.memoNotFound(memoId);
		}

		this.#logger.debug(`Memo retrieved: ${memoId} for user: ${userId}`);

		return { memo: MemoMapper.toResponse(memo) };
	}

	/**
	 * 메모 목록 조회 (커서 기반 페이지네이션)
	 */
	async findMany(params: {
		userId: string;
		cursor?: number;
		size?: number;
	}): Promise<CursorPaginatedResponse<MemoResponse, number>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		const memos = await this.memoRepository.findManyByUserId({
			userId: params.userId,
			cursor,
			size,
		});

		return this.paginationService.createCursorPaginatedResponse<
			MemoResponse,
			number
		>({
			items: MemoMapper.toManyResponse(memos),
			size,
		});
	}

	/**
	 * 메모 리소스 제한 정보 조회
	 */
	async getResourceLimitInfo(
		userId: string,
	): Promise<{ currentCount: number; maxPerUser: number }> {
		const currentCount = await this.memoRepository.countByUserId(userId);
		return { currentCount, maxPerUser: MEMO_LIMITS.MAX_PER_USER };
	}

	/**
	 * 메모 수정
	 */
	async update(
		userId: string,
		memoId: number,
		data: UpdateMemoData,
	): Promise<{ message: string; memo: MemoResponse }> {
		const memo = await this.memoRepository.findByIdAndUserId(memoId, userId);
		if (!memo) {
			throw BusinessExceptions.memoNotFound(memoId);
		}

		const updated = await this.memoRepository.update(memoId, {
			content: data.content,
		});

		this.#logger.log(`Memo updated: ${memoId} for user: ${userId}`);

		return {
			message: "메모가 수정되었습니다.",
			memo: MemoMapper.toResponse(updated),
		};
	}

	/**
	 * 메모 핀 토글
	 */
	async togglePin(
		userId: string,
		memoId: number,
		isPinned: boolean,
	): Promise<{ message: string; memo: MemoResponse }> {
		const memo = await this.memoRepository.findByIdAndUserId(memoId, userId);
		if (!memo) {
			throw BusinessExceptions.memoNotFound(memoId);
		}

		const updated = await this.memoRepository.update(memoId, { isPinned });

		this.#logger.log(
			`Memo ${isPinned ? "pinned" : "unpinned"}: ${memoId} for user: ${userId}`,
		);

		return {
			message: isPinned
				? "메모가 고정되었습니다."
				: "메모 고정이 해제되었습니다.",
			memo: MemoMapper.toResponse(updated),
		};
	}

	/**
	 * 메모 순서 변경
	 */
	async reorder(
		id: number,
		userId: string,
		data: { targetMemoId?: number; position: "before" | "after" },
	): Promise<{ message: string; memo: MemoResponse }> {
		const { targetMemoId, position } = data;

		return this.database.$transaction(async (tx) => {
			const memo = await this.memoRepository.findByIdAndUserId(id, userId, tx);
			if (!memo) {
				throw BusinessExceptions.memoNotFound(id);
			}

			if (targetMemoId === id) {
				return {
					message: "메모 순서가 변경되었습니다.",
					memo: MemoMapper.toResponse(memo),
				};
			}

			const newSortOrder = targetMemoId
				? await this.#reorderRelativeTo(
						memo.sortOrder,
						targetMemoId,
						position,
						userId,
						tx,
					)
				: await this.#reorderToEdge(memo.sortOrder, position, userId, tx);

			const updated = await this.memoRepository.updateSortOrder(
				id,
				newSortOrder,
				tx,
			);

			this.#logger.log(
				`Memo reordered: ${id} to sortOrder ${newSortOrder} for user: ${userId}`,
			);

			return {
				message: "메모 순서가 변경되었습니다.",
				memo: MemoMapper.toResponse(updated),
			};
		});
	}

	/**
	 * 메모 삭제
	 */
	async delete(userId: string, memoId: number): Promise<{ message: string }> {
		const memo = await this.memoRepository.findByIdAndUserId(memoId, userId);
		if (!memo) {
			throw BusinessExceptions.memoNotFound(memoId);
		}

		await this.memoRepository.delete(memoId);

		this.#logger.log(`Memo deleted: ${memoId} for user: ${userId}`);

		return { message: "메모가 삭제되었습니다." };
	}

	/**
	 * 메모를 할 일로 변환
	 */
	async convertToTodo(
		userId: string,
		memoId: number,
		data: ConvertMemoToTodoData,
	): Promise<{ message: string; todo: Todo }> {
		// 1. 메모 존재/소유권 확인 (읽기 전용, TX 외부)
		const memo = await this.memoRepository.findByIdAndUserId(memoId, userId);
		if (!memo) {
			throw BusinessExceptions.memoNotFound(memoId);
		}

		// 2. Todo 생성 (TodoService.create 내부 TX)
		const todo = await this.todoService.create({
			userId,
			title: memo.content.substring(0, 200),
			categoryId: data.categoryId,
			startDate: data.startDate,
			endDate: data.endDate,
			scheduledTime: data.scheduledTime,
			isAllDay: data.isAllDay ?? true,
			visibility: data.visibility ?? "PUBLIC",
			items: data.items,
		});

		// 3. 메모 삭제 (Todo 생성 커밋 후)
		await this.memoRepository.delete(memoId);

		this.#logger.log(
			`Memo ${memoId} converted to todo ${todo.id} for user: ${userId}`,
		);

		return { message: "메모가 할 일로 변환되었습니다.", todo };
	}

	/**
	 * 메모를 여러 할 일로 일괄 변환
	 *
	 * 모든 Todo+SubTodo를 순차 생성하고 메모를 삭제합니다.
	 * 반복 일정은 TodoService.createRecurring, 단건은 TodoService.create를 호출합니다.
	 */
	async convertToTodos(
		userId: string,
		memoId: number,
		data: ConvertMemoToTodosData,
		timezone: string = "UTC",
	): Promise<{ message: string; todos: Todo[] }> {
		// 1. 메모 존재/소유권 확인 (읽기 전용, TX 외부)
		const memo = await this.memoRepository.findByIdAndUserId(memoId, userId);
		if (!memo) {
			throw BusinessExceptions.memoNotFound(memoId);
		}

		// 2. 모든 Todo 생성 (각 TodoService 메서드가 자체 TX 관리)
		const todos: Todo[] = [];

		for (const todoData of data.todos) {
			if (todoData.isRecurring && todoData.recurrence) {
				// 반복 일정: createRecurring은 여러 Todo 인스턴스를 생성
				const result = await this.todoService.createRecurring(
					{
						userId,
						title: todoData.title,
						categoryId: todoData.categoryId,
						startDate: toDateString(todoData.startDate),
						endDate: toDateString(todoData.recurrence.endDate),
						daysOfWeek: todoData.recurrence.daysOfWeek,
						scheduledTime: todoData.scheduledTime
							? `${String(todoData.scheduledTime.getUTCHours()).padStart(2, "0")}:${String(todoData.scheduledTime.getUTCMinutes()).padStart(2, "0")}`
							: null,
						isAllDay: todoData.isAllDay ?? true,
						visibility: todoData.visibility ?? "PUBLIC",
					},
					timezone,
				);
				todos.push(...result.todos);
			} else {
				// 단건 일정
				const todo = await this.todoService.create({
					userId,
					title: todoData.title,
					categoryId: todoData.categoryId,
					startDate: todoData.startDate,
					endDate: todoData.endDate,
					scheduledTime: todoData.scheduledTime,
					isAllDay: todoData.isAllDay ?? true,
					visibility: todoData.visibility ?? "PUBLIC",
					items: todoData.items,
				});
				todos.push(todo);
			}
		}

		// 3. 메모 삭제 (모든 Todo 생성 성공 후)
		await this.memoRepository.delete(memoId);

		this.#logger.log(
			`Memo ${memoId} converted to ${todos.length} todos for user: ${userId}`,
		);

		return {
			message: `메모가 ${todos.length}개의 할 일로 변환되었습니다.`,
			todos,
		};
	}

	// =========================================================================
	// Private helpers — reorder
	// =========================================================================

	async #reorderRelativeTo(
		currentSortOrder: number,
		targetMemoId: number,
		position: "before" | "after",
		userId: string,
		tx: TransactionClient,
	): Promise<number> {
		const targetMemo = await this.memoRepository.findByIdAndUserId(
			targetMemoId,
			userId,
			tx,
		);

		if (!targetMemo) {
			throw BusinessExceptions.memoReorderTargetNotFound(targetMemoId);
		}

		let newSortOrder =
			position === "before" ? targetMemo.sortOrder : targetMemo.sortOrder + 1;

		if (currentSortOrder < newSortOrder) {
			await this.memoRepository.shiftSortOrders(
				userId,
				currentSortOrder + 1,
				newSortOrder - 1,
				-1,
				tx,
			);
			newSortOrder -= 1;
		} else {
			await this.memoRepository.shiftSortOrders(
				userId,
				newSortOrder,
				currentSortOrder - 1,
				1,
				tx,
			);
		}

		return newSortOrder;
	}

	async #reorderToEdge(
		currentSortOrder: number,
		position: "before" | "after",
		userId: string,
		tx: TransactionClient,
	): Promise<number> {
		if (position === "before") {
			await this.memoRepository.shiftSortOrders(
				userId,
				0,
				currentSortOrder - 1,
				1,
				tx,
			);
			return 0;
		}

		const maxSortOrder = await this.memoRepository.getMaxSortOrder(userId, tx);
		await this.memoRepository.shiftSortOrders(
			userId,
			currentSortOrder + 1,
			null,
			-1,
			tx,
		);
		return maxSortOrder;
	}
}
