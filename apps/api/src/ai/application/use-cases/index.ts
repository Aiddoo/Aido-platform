import { ParseMemoUseCase } from "./parse-memo/parse-memo.use-case";
import { ParseTodoUseCase } from "./parse-todo/parse-todo.use-case";

/** AI 커맨드 use-case (모듈 등록용 배럴). */
export const AiUseCases = [ParseTodoUseCase, ParseMemoUseCase];
