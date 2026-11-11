import { z } from "zod";

import { llmInteger, llmObject } from "../../../generation/application/messages/llm-output.wire.js";
import { todoDraftShape } from "./parse-todo-draft.wire.js";

/** parse-memo LLM 출력 schema(관대). 할 일·항목 수는 서버 정규화가 앞에서부터 자른다. */
export const memoDraftSchema = llmObject({
  todos: z
    .array(
      llmObject({
        ...todoDraftShape,
        items: z
          .array(llmObject({ title: z.string() }))
          .describe("Explicit sub-steps only; [] for a single action."),
        duplicateOfTodoId: llmInteger()
          .nullable()
          .describe("Id of the same to-do in context.upcomingTodos, or null."),
      }),
    )
    .describe("Independent to-dos in memo order, only the first 8. Never group them."),
  // todos 뒤에 두어 모델이 할 일을 쓴 다음 전체 수를 세게 한다(앞에 두면 사고 없이 과대 집계했다).
  totalTaskCount: llmInteger()
    .nullable()
    .describe(
      "Actionable tasks in the whole memo, including ones not written in todos. Excludes reflections, headings, and sub-steps. null when unknown.",
    ),
});

export type MemoDraft = z.infer<typeof memoDraftSchema>;
