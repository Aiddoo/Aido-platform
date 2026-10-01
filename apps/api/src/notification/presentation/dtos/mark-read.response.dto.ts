import { markReadResponseSchema } from "@aido/validators";
import type { z } from "zod";

export const MarkReadResponseDto = markReadResponseSchema.meta({ id: "MarkReadResponseDto" });
export type MarkReadResponseDto = z.infer<typeof MarkReadResponseDto>;
