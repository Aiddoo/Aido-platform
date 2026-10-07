import { reorderMemoSchema } from "@aido/api";
import type { z } from "zod";

export const ReorderMemoDto = reorderMemoSchema.meta({ id: "ReorderMemoDto" });
export type ReorderMemoDto = z.infer<typeof ReorderMemoDto>;
