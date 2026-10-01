import { unreadCountResponseSchema } from "@aido/validators";
import type { z } from "zod";

export const UnreadCountResponseDto = unreadCountResponseSchema.meta({
	id: "UnreadCountResponseDto",
});
export type UnreadCountResponseDto = z.infer<typeof UnreadCountResponseDto>;
