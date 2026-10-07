import { getCheersQuerySchema } from "@aido/validators";
import type { z } from "zod";

export const GetCheersQueryDto = getCheersQuerySchema.meta({
  id: "GetCheersQueryDto",
  apiParameter: true,
});
export type GetCheersQueryDto = z.infer<typeof GetCheersQueryDto>;
