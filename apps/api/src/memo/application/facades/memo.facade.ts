import type { Memo as MemoResponse } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { GetMemoQuery, type GetMemoResult } from "../queries/get-memo.query";
import {
	GetMemoResourceLimitQuery,
	type MemoResourceLimit,
} from "../queries/get-memo-resource-limit.query";
import { GetMemosQuery } from "../queries/get-memos.query";
import {
	ConvertMemoToTodoCommand,
	type ConvertMemoToTodoData,
	type ConvertMemoToTodoResult,
} from "../use-cases/convert-memo-to-todo/convert-memo-to-todo.command";
import {
	ConvertMemoToTodosCommand,
	type ConvertMemoToTodosData,
	type ConvertMemoToTodosResult,
} from "../use-cases/convert-memo-to-todos/convert-memo-to-todos.command";
import {
	CreateMemoCommand,
	type MemoMutationResult,
} from "../use-cases/create-memo/create-memo.command";
import {
	DeleteMemoCommand,
	type DeleteMemoResult,
} from "../use-cases/delete-memo/delete-memo.command";
import { ReorderMemoCommand } from "../use-cases/reorder-memo/reorder-memo.command";
import { ToggleMemoPinCommand } from "../use-cases/toggle-memo-pin/toggle-memo-pin.command";
import { UpdateMemoCommand } from "../use-cases/update-memo/update-memo.command";

/**
 * 메모 애플리케이션 서비스(Facade) — 컨트롤러의 유일한 주입 대상.
 * 명령/조회를 CommandBus/QueryBus로 흡수한다.
 */
@Injectable()
export class MemoFacade {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	create(userId: string, content: string): Promise<MemoMutationResult> {
		return this.commandBus.execute(new CreateMemoCommand(userId, content));
	}

	findOne(userId: string, memoId: number): Promise<GetMemoResult> {
		return this.queryBus.execute(new GetMemoQuery(userId, memoId));
	}

	findMany(params: {
		userId: string;
		cursor?: number;
		size?: number;
	}): Promise<CursorPaginatedResponse<MemoResponse, number>> {
		return this.queryBus.execute(
			new GetMemosQuery(params.userId, params.cursor, params.size),
		);
	}

	getResourceLimit(userId: string): Promise<MemoResourceLimit> {
		return this.queryBus.execute(new GetMemoResourceLimitQuery(userId));
	}

	update(
		userId: string,
		memoId: number,
		content: string,
	): Promise<MemoMutationResult> {
		return this.commandBus.execute(
			new UpdateMemoCommand(userId, memoId, content),
		);
	}

	togglePin(
		userId: string,
		memoId: number,
		isPinned: boolean,
	): Promise<MemoMutationResult> {
		return this.commandBus.execute(
			new ToggleMemoPinCommand(userId, memoId, isPinned),
		);
	}

	reorder(
		memoId: number,
		userId: string,
		data: { targetMemoId?: number; position: "before" | "after" },
	): Promise<MemoMutationResult> {
		return this.commandBus.execute(
			new ReorderMemoCommand(userId, memoId, data.position, data.targetMemoId),
		);
	}

	delete(userId: string, memoId: number): Promise<DeleteMemoResult> {
		return this.commandBus.execute(new DeleteMemoCommand(userId, memoId));
	}

	convertToTodo(
		userId: string,
		memoId: number,
		data: ConvertMemoToTodoData,
	): Promise<ConvertMemoToTodoResult> {
		return this.commandBus.execute(
			new ConvertMemoToTodoCommand(userId, memoId, data),
		);
	}

	convertToTodos(
		userId: string,
		memoId: number,
		data: ConvertMemoToTodosData,
		timezone: string = "UTC",
	): Promise<ConvertMemoToTodosResult> {
		return this.commandBus.execute(
			new ConvertMemoToTodosCommand(userId, memoId, data, timezone),
		);
	}
}
