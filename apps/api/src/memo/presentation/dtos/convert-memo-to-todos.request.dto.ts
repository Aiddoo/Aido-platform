import { convertMemoToTodosSchema } from "@aido/api";
import type { z } from "zod";

export const ConvertMemoToTodosDto = convertMemoToTodosSchema.meta({ id: "ConvertMemoToTodosDto" });
export type ConvertMemoToTodosDto = z.infer<typeof ConvertMemoToTodosDto>;
