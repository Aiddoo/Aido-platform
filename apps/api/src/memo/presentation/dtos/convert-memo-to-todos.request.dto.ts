import { convertMemoToTodosSchema } from "@aido/validators";
import type { z } from "zod";

export const ConvertMemoToTodosDto = convertMemoToTodosSchema.meta({ id: "ConvertMemoToTodosDto" });
export type ConvertMemoToTodosDto = z.infer<typeof ConvertMemoToTodosDto>;
