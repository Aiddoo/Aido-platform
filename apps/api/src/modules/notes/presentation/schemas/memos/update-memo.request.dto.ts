import { updateMemoSchema } from "@aido/api";
import type { z } from "zod";

export const UpdateMemoDto = updateMemoSchema.meta({ id: "UpdateMemoDto" });
export type UpdateMemoDto = z.infer<typeof UpdateMemoDto>;
