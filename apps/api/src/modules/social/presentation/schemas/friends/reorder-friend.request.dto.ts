import { reorderFriendSchema } from "@aido/api";
import type { z } from "zod";

export const ReorderFriendDto = reorderFriendSchema.meta({ id: "ReorderFriendDto" });
export type ReorderFriendDto = z.infer<typeof ReorderFriendDto>;
