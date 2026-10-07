import { createTodoCategorySchema } from "@aido/api";
import type { z } from "zod";

export const CreateTodoCategoryDto = createTodoCategorySchema.meta({ id: "CreateTodoCategoryDto" });
export type CreateTodoCategoryDto = z.infer<typeof CreateTodoCategoryDto>;
