import { ConvertMemoToTodoUseCase } from "./convert-memo-to-todo/convert-memo-to-todo.use-case";
import { ConvertMemoToTodosUseCase } from "./convert-memo-to-todos/convert-memo-to-todos.use-case";
import { CreateMemoUseCase } from "./create-memo/create-memo.use-case";
import { DeleteMemoUseCase } from "./delete-memo/delete-memo.use-case";
import { ReorderMemoUseCase } from "./reorder-memo/reorder-memo.use-case";
import { ToggleMemoPinUseCase } from "./toggle-memo-pin/toggle-memo-pin.use-case";
import { UpdateMemoUseCase } from "./update-memo/update-memo.use-case";

export {
	ConvertMemoToTodosUseCase,
	ConvertMemoToTodoUseCase,
	CreateMemoUseCase,
	DeleteMemoUseCase,
	ReorderMemoUseCase,
	ToggleMemoPinUseCase,
	UpdateMemoUseCase,
};

/** 메모 커맨드 use-case (모듈 등록용 배럴). */
export const MemoUseCases = [
	CreateMemoUseCase,
	UpdateMemoUseCase,
	ToggleMemoPinUseCase,
	ReorderMemoUseCase,
	DeleteMemoUseCase,
	ConvertMemoToTodoUseCase,
	ConvertMemoToTodosUseCase,
];
