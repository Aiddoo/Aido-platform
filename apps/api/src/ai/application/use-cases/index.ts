import { ParseMemoHandler } from "./parse-memo/parse-memo.handler";
import { ParseTodoHandler } from "./parse-todo/parse-todo.handler";

/** AI 커맨드 핸들러 (모듈 등록용 배럴). */
export const CommandHandlers = [ParseTodoHandler, ParseMemoHandler];
