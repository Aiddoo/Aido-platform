import { ErrorCode } from "@aido/errors";
import type { Todo } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import {
	TODO_CREATOR,
	type TodoCreatorPort,
} from "../../ports/todo-creator.port";

/** 단건 변환 입력 (컨트롤러가 날짜/시간을 파싱해 전달). */
export interface ConvertMemoToTodoData {
	categoryId: number;
	startDate: Date;
	endDate?: Date | null;
	scheduledTime?: Date | null;
	isAllDay?: boolean;
	visibility?: "PUBLIC" | "PRIVATE";
	items?: { title: string }[];
}

/** 단건 변환 결과. */
export interface ConvertMemoToTodoResult {
	message: string;
	todo: Todo;
}

/** 메모를 단일 할 일로 변환하는 입력 (변환 후 메모 삭제). */
export interface ConvertMemoToTodoInput {
	userId: string;
	memoId: number;
	data: ConvertMemoToTodoData;
}

/**
 * 메모 → 단일 할 일 변환 use-case.
 *
 * 소유권 확인 → TodoCreatorPort로 할 일 생성(자체 TX) → 커밋 후 메모 삭제.
 * 메모 내용은 도메인 정책(앞 200자)으로 할 일 제목이 된다.
 */
@Injectable()
export class ConvertMemoToTodoUseCase {
	readonly #logger = new Logger(ConvertMemoToTodoUseCase.name);

	constructor(
		@Inject(MEMO_REPOSITORY)
		private readonly repository: MemoRepositoryPort,
		@Inject(TODO_CREATOR)
		private readonly todoCreator: TodoCreatorPort,
	) {}

	async execute(
		input: ConvertMemoToTodoInput,
	): Promise<ConvertMemoToTodoResult> {
		const { userId, memoId, data } = input;

		// 1. 소유권 확인 (읽기 전용, TX 외부)
		const memo = await this.repository.findByIdAndUserId(memoId, userId);
		if (!memo) {
			throw new ApplicationException(ErrorCode.MEMO_2001, { memoId });
		}

		// 2. 할 일 생성 (todo 측 use-case 내부 TX)
		const todo = await this.todoCreator.createTodo({
			userId,
			title: memo.toTodoTitle(),
			categoryId: data.categoryId,
			startDate: data.startDate,
			endDate: data.endDate,
			scheduledTime: data.scheduledTime,
			isAllDay: data.isAllDay ?? true,
			visibility: data.visibility ?? "PUBLIC",
			items: data.items,
		});

		// 3. 메모 삭제 (할 일 생성 커밋 후)
		await this.repository.delete(memoId);

		this.#logger.log(
			`Memo ${memoId} converted to todo ${todo.id} for user: ${userId}`,
		);

		return { message: "메모가 할 일로 변환되었습니다.", todo };
	}
}
