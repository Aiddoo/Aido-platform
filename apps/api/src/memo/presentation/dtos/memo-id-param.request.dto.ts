import { memoIdParamSchema } from "@aido/validators";
import type { z } from "zod";

export const MemoIdParamDto = memoIdParamSchema.meta({ id: "MemoIdParamDto", apiParameter: true });
export type MemoIdParamDto = z.infer<typeof MemoIdParamDto>;
