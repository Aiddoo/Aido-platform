import { todoResourceLimitQuerySchema } from "@aido/validators";
import type { z } from "zod";

export const TodoResourceLimitQueryDto = todoResourceLimitQuerySchema.meta({
  id: "TodoResourceLimitQueryDto",
  apiParameter: true,
});
export type TodoResourceLimitQueryDto = z.infer<typeof TodoResourceLimitQueryDto>;
