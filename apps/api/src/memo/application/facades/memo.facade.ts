import type { Memo as MemoResponse } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import {
	type GetMemoResult,
	GetMemoUseCase,
} from "../queries/get-memo/get-memo.use-case";
import {
	GetMemoResourceLimitUseCase,
	type MemoResourceLimit,
} from "../queries/get-memo-resource-limit/get-memo-resource-limit.use-case";
import { GetMemosUseCase } from "../queries/get-memos/get-memos.use-case";
import {
	type ConvertMemoToTodoData,
	type ConvertMemoToTodoResult,
	ConvertMemoToTodoUseCase,
} from "../use-cases/convert-memo-to-todo/convert-memo-to-todo.use-case";
import {
	type ConvertMemoToTodosData,
	type ConvertMemoToTodosResult,
	ConvertMemoToTodosUseCase,
} from "../use-cases/convert-memo-to-todos/convert-memo-to-todos.use-case";
import {
	CreateMemoUseCase,
	type MemoMutationResult,
} from "../use-cases/create-memo/create-memo.use-case";
import {
	type DeleteMemoResult,
	DeleteMemoUseCase,
} from "../use-cases/delete-memo/delete-memo.use-case";
import { ReorderMemoUseCase } from "../use-cases/reorder-memo/reorder-memo.use-case";
import { ToggleMemoPinUseCase } from "../use-cases/toggle-memo-pin/toggle-memo-pin.use-case";
import { UpdateMemoUseCase } from "../use-cases/update-memo/update-memo.use-case";

/**
 * 메모 애플리케이션 서비스(Facade) — 컨트롤러의 유일한 주입 대상.
 * 명령/조회를 개별 use-case로 위임한다.
 */
@Injectable()
export class MemoFacade {
	constructor(
		private readonly createMemoUseCase: CreateMemoUseCase,
		private readonly getMemoUseCase: GetMemoUseCase,
		private readonly getMemosUseCase: GetMemosUseCase,
		private readonly getMemoResourceLimitUseCase: GetMemoResourceLimitUseCase,
		private readonly updateMemoUseCase: UpdateMemoUseCase,
		private readonly toggleMemoPinUseCase: ToggleMemoPinUseCase,
		private readonly reorderMemoUseCase: ReorderMemoUseCase,
		private readonly deleteMemoUseCase: DeleteMemoUseCase,
		private readonly convertMemoToTodoUseCase: ConvertMemoToTodoUseCase,
		private readonly convertMemoToTodosUseCase: ConvertMemoToTodosUseCase,
	) {}

	create(userId: string, content: string): Promise<MemoMutationResult> {
		return this.createMemoUseCase.execute({ userId, content });
	}

	findOne(userId: string, memoId: number): Promise<GetMemoResult> {
		return this.getMemoUseCase.execute({ userId, memoId });
	}

	findMany(params: {
		userId: string;
		cursor?: number;
		size?: number;
	}): Promise<CursorPaginatedResponse<MemoResponse, number>> {
		return this.getMemosUseCase.execute({
			userId: params.userId,
			cursor: params.cursor,
			size: params.size,
		});
	}

	getResourceLimit(userId: string): Promise<MemoResourceLimit> {
		return this.getMemoResourceLimitUseCase.execute({ userId });
	}

	update(
		userId: string,
		memoId: number,
		content: string,
	): Promise<MemoMutationResult> {
		return this.updateMemoUseCase.execute({ userId, memoId, content });
	}

	togglePin(
		userId: string,
		memoId: number,
		isPinned: boolean,
	): Promise<MemoMutationResult> {
		return this.toggleMemoPinUseCase.execute({ userId, memoId, isPinned });
	}

	reorder(
		memoId: number,
		userId: string,
		data: { targetMemoId?: number; position: "before" | "after" },
	): Promise<MemoMutationResult> {
		return this.reorderMemoUseCase.execute({
			userId,
			memoId,
			position: data.position,
			targetMemoId: data.targetMemoId,
		});
	}

	delete(userId: string, memoId: number): Promise<DeleteMemoResult> {
		return this.deleteMemoUseCase.execute({ userId, memoId });
	}

	convertToTodo(
		userId: string,
		memoId: number,
		data: ConvertMemoToTodoData,
	): Promise<ConvertMemoToTodoResult> {
		return this.convertMemoToTodoUseCase.execute({ userId, memoId, data });
	}

	convertToTodos(
		userId: string,
		memoId: number,
		data: ConvertMemoToTodosData,
		timezone: string = "UTC",
	): Promise<ConvertMemoToTodosResult> {
		return this.convertMemoToTodosUseCase.execute({
			userId,
			memoId,
			data,
			timezone,
		});
	}
}
