import { resendVerificationSchema } from "@aido/api/contracts/auth";
import type { z } from "zod";

export const ResendVerificationDto = resendVerificationSchema.meta({ id: "ResendVerificationDto" });
export type ResendVerificationDto = z.infer<typeof ResendVerificationDto>;
