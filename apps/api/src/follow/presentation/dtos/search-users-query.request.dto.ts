import { searchUsersQuerySchema } from "@aido/api";
import type { z } from "zod";

export const SearchUsersQueryDto = searchUsersQuerySchema.meta({
  id: "SearchUsersQueryDto",
  apiParameter: true,
});
export type SearchUsersQueryDto = z.infer<typeof SearchUsersQueryDto>;
