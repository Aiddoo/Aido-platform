import { getCheersQuerySchema } from "@aido/api";
import type { z } from "zod";

export const GetCheersQueryDto = getCheersQuerySchema.meta({
  id: "GetCheersQueryDto",
  apiParameter: true,
});
export type GetCheersQueryDto = z.infer<typeof GetCheersQueryDto>;
