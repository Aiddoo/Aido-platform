import { markReadResponseSchema } from "@aido/api";
import type { z } from "zod";

export const MarkReadResponseDto = markReadResponseSchema.meta({ id: "MarkReadResponseDto" });
export type MarkReadResponseDto = z.infer<typeof MarkReadResponseDto>;
