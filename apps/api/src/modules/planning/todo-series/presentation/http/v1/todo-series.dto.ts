import { todoSeriesIdParamSchema, todoSeriesResponseSchema } from "@aido/api";
import type { z } from "zod";

export const TodoSeriesIdParamDto = todoSeriesIdParamSchema.meta({
  id: "TodoSeriesIdParamDto",
  apiParameter: true,
});
export type TodoSeriesIdParamDto = z.infer<typeof TodoSeriesIdParamDto>;

export const TodoSeriesResponseDto = todoSeriesResponseSchema.meta({ id: "TodoSeriesResponseDto" });
export type TodoSeriesResponseDto = z.infer<typeof TodoSeriesResponseDto>;
