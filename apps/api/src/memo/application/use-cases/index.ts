import { ConvertMemoToTodoHandler } from "./convert-memo-to-todo/convert-memo-to-todo.handler";
import { ConvertMemoToTodosHandler } from "./convert-memo-to-todos/convert-memo-to-todos.handler";
import { CreateMemoHandler } from "./create-memo/create-memo.handler";
import { DeleteMemoHandler } from "./delete-memo/delete-memo.handler";
import { ReorderMemoHandler } from "./reorder-memo/reorder-memo.handler";
import { ToggleMemoPinHandler } from "./toggle-memo-pin/toggle-memo-pin.handler";
import { UpdateMemoHandler } from "./update-memo/update-memo.handler";

/** 메모 커맨드 핸들러 (모듈 등록용 배럴). */
export const CommandHandlers = [
	CreateMemoHandler,
	UpdateMemoHandler,
	ToggleMemoPinHandler,
	ReorderMemoHandler,
	DeleteMemoHandler,
	ConvertMemoToTodoHandler,
	ConvertMemoToTodosHandler,
];
