import { createMemoSchema } from "@aido/validators";
import type { z } from "zod";

export const CreateMemoDto = createMemoSchema.meta({ id: "CreateMemoDto" });
export type CreateMemoDto = z.infer<typeof CreateMemoDto>;
