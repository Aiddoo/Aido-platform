import { GetAiUsageUseCase } from "./queries/get-ai-usage/get-ai-usage.use-case.js";
import { ParseMemoUseCase } from "./use-cases/parse-memo/parse-memo.use-case.js";
import { ParseTodoUseCase } from "./use-cases/parse-todo/parse-todo.use-case.js";

export const AI_PROVIDERS = [ParseTodoUseCase, ParseMemoUseCase, GetAiUsageUseCase] as const;
