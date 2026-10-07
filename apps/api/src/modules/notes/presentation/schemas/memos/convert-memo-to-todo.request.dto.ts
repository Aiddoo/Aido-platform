import { convertMemoToTodoSchema } from "@aido/api";
import type { z } from "zod";

export const ConvertMemoToTodoDto = convertMemoToTodoSchema.meta({ id: "ConvertMemoToTodoDto" });
export type ConvertMemoToTodoDto = z.infer<typeof ConvertMemoToTodoDto>;
