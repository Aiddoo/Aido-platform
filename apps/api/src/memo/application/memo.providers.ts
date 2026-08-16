import { GetMemoResourceLimitUseCase } from "./queries/get-memo-resource-limit/get-memo-resource-limit.use-case";
import { GetMemoUseCase } from "./queries/get-memo/get-memo.use-case";
import { GetMemosUseCase } from "./queries/get-memos/get-memos.use-case";
import { ConvertMemoToTodoUseCase } from "./use-cases/convert-memo-to-todo/convert-memo-to-todo.use-case";
import { ConvertMemoToTodosUseCase } from "./use-cases/convert-memo-to-todos/convert-memo-to-todos.use-case";
import { CreateMemoUseCase } from "./use-cases/create-memo/create-memo.use-case";
import { DeleteMemoUseCase } from "./use-cases/delete-memo/delete-memo.use-case";
import { ReorderMemoUseCase } from "./use-cases/reorder-memo/reorder-memo.use-case";
import { ToggleMemoPinUseCase } from "./use-cases/toggle-memo-pin/toggle-memo-pin.use-case";
import { UpdateMemoUseCase } from "./use-cases/update-memo/update-memo.use-case";

export const MEMO_PROVIDERS = [
	CreateMemoUseCase,
	UpdateMemoUseCase,
	ToggleMemoPinUseCase,
	ReorderMemoUseCase,
	DeleteMemoUseCase,
	ConvertMemoToTodoUseCase,
	ConvertMemoToTodosUseCase,
	GetMemoUseCase,
	GetMemosUseCase,
	GetMemoResourceLimitUseCase,
] as const;
