import {
  cheerLimitInfoSchema,
  createCheerResponseSchema,
  markCheerReadResponseSchema,
} from "@aido/validators";
import type { z } from "zod";

export const CheerLimitInfoDto = cheerLimitInfoSchema.meta({ id: "CheerLimitInfoDto" });
export type CheerLimitInfoDto = z.infer<typeof CheerLimitInfoDto>;

export const CreateCheerResponseDto = createCheerResponseSchema.meta({
  id: "CreateCheerResponseDto",
});
export type CreateCheerResponseDto = z.infer<typeof CreateCheerResponseDto>;

export const MarkCheerReadResponseDto = markCheerReadResponseSchema.meta({
  id: "MarkCheerReadResponseDto",
});
export type MarkCheerReadResponseDto = z.infer<typeof MarkCheerReadResponseDto>;
