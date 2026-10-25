import { readFileSync } from "node:fs";

import { parsedTodoDataSchema } from "@aido/api";
import { z } from "zod";

import { todoDraftSchema } from "#api/modules/ai-assistance/application/prompts/parsing/shared/v2/todo-draft.schema";

/** parse-todo golden 한 줄. draft는 모델이 내야 할 표현, expected는 서버 계산 결과다. */
export const parseTodoGoldenCaseSchema = z.object({
  id: z.string(),
  locale: z.enum(["ko", "en"]),
  timezone: z.string(),
  now: z.iso.datetime(),
  input: z.string(),
  draft: todoDraftSchema,
  expected: parsedTodoDataSchema,
});

export type ParseTodoGoldenCase = z.infer<typeof parseTodoGoldenCaseSchema>;

export function loadParseTodoGoldenCases(locale: "ko" | "en"): ParseTodoGoldenCase[] {
  const path = new URL(`./parse-todo.${locale}.jsonl`, import.meta.url);
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => parseTodoGoldenCaseSchema.parse(JSON.parse(line)));
}
