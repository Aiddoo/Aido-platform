import { redeemInviteRequestSchema } from "@aido/api";
import type { z } from "zod";

export const RedeemInviteDto = redeemInviteRequestSchema.meta({ id: "RedeemInviteDto" });
export type RedeemInviteDto = z.infer<typeof RedeemInviteDto>;
