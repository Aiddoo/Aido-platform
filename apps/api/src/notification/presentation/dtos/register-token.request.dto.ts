import { registerPushTokenSchema } from "@aido/api";
import type { z } from "zod";

export const RegisterPushTokenDto = registerPushTokenSchema.meta({ id: "RegisterPushTokenDto" });
export type RegisterPushTokenDto = z.infer<typeof RegisterPushTokenDto>;
