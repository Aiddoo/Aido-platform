import { todoResourceLimitQuerySchema } from "@aido/api";
import type { z } from "zod";

export const TodoResourceLimitQueryDto = todoResourceLimitQuerySchema.meta({
  id: "TodoResourceLimitQueryDto",
  apiParameter: true,
});
export type TodoResourceLimitQueryDto = z.infer<typeof TodoResourceLimitQueryDto>;
