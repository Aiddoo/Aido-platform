/**
 * ConvertMemoToTodoHandler 단위 테스트
 *
 * CreateTodoCommand 디스패치(제목 축약)와 커밋 후 메모 삭제를 검증한다.
 */

import { CommandBus } from "@nestjs/cqrs";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { CreateTodoCommand } from "@/todo";
import { Memo } from "../../../domain/entities/memo.entity";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import { ConvertMemoToTodoCommand } from "./convert-memo-to-todo.command";
import { ConvertMemoToTodoHandler } from "./convert-memo-to-todo.handler";

const memoEntity = (content: string): Memo =>
	Memo.reconstitute({
		id: 1,
		userId: "user-1",
		content,
		isPinned: false,
		sortOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

const command = () =>
	new ConvertMemoToTodoCommand("user-1", 1, {
		categoryId: 5,
		startDate: new Date("2026-04-06"),
	});

describe("ConvertMemoToTodoHandler — 메모→할 일 변환 핸들러", () => {
	let handler: ConvertMemoToTodoHandler;
	let repository: Mocked<MemoRepositoryPort>;
	let commandBus: Mocked<CommandBus>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			ConvertMemoToTodoHandler,
		).compile();
		handler = unit;
		repository = unitRef.get(MEMO_REPOSITORY);
		commandBus = unitRef.get(CommandBus);
	});

	it("메모가 없으면 MEMO_2001을 던진다", async () => {
		repository.findByIdAndUserId.mockResolvedValue(null);

		await expect(handler.execute(command())).rejects.toMatchObject({
			errorCode: "MEMO_2001",
		});
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it("제목을 200자로 축약해 CreateTodoCommand를 디스패치하고 메모를 삭제한다", async () => {
		repository.findByIdAndUserId.mockResolvedValue(memoEntity("x".repeat(300)));
		commandBus.execute.mockResolvedValue({ id: 10 });

		const result = await handler.execute(command());

		const dispatched = commandBus.execute.mock.calls[0]?.[0];
		expect(dispatched).toBeInstanceOf(CreateTodoCommand);
		expect(repository.delete).toHaveBeenCalledWith(1);
		expect(result.message).toBe("메모가 할 일로 변환되었습니다.");
	});
});
