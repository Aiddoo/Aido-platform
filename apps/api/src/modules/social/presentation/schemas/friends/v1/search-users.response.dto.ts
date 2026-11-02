import { searchUsersResponseSchema } from "@aido/api";
import type { z } from "zod";

export const SearchUsersResponseDto = searchUsersResponseSchema.meta({
  id: "SearchUsersResponseDto",
});
export type SearchUsersResponseDto = z.infer<typeof SearchUsersResponseDto>;
