import { createTodoCategorySchema } from "@aido/validators";
import type { z } from "zod";

export const CreateTodoCategoryDto = createTodoCategorySchema.meta({ id: "CreateTodoCategoryDto" });
export type CreateTodoCategoryDto = z.infer<typeof CreateTodoCategoryDto>;
