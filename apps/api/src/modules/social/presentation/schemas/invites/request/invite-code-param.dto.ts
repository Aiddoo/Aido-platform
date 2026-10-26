import { inviteCodeParamSchema } from "@aido/api";
import type { z } from "zod";

export const InviteCodeParamDto = inviteCodeParamSchema.meta({
  id: "InviteCodeParamDto",
  apiParameter: true,
});
export type InviteCodeParamDto = z.infer<typeof InviteCodeParamDto>;
