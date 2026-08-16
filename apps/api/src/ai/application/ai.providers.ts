import { GetAiUsageUseCase } from "./queries/get-ai-usage/get-ai-usage.use-case";
import { ParseMemoUseCase } from "./use-cases/parse-memo/parse-memo.use-case";
import { ParseTodoUseCase } from "./use-cases/parse-todo/parse-todo.use-case";

export const AI_PROVIDERS = [ParseTodoUseCase, ParseMemoUseCase, GetAiUsageUseCase] as const;
