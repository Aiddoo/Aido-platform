import { registerPushTokenSchema, unregisterPushTokenQuerySchema } from "@aido/api";
import type { z } from "zod";

export const RegisterPushTokenDto = registerPushTokenSchema.meta({ id: "RegisterPushTokenDto" });
export type RegisterPushTokenDto = z.infer<typeof RegisterPushTokenDto>;

export const UnregisterPushTokenQueryDto = unregisterPushTokenQuerySchema.meta({
  id: "UnregisterPushTokenQueryDto",
  apiParameter: true,
});
export type UnregisterPushTokenQueryDto = z.infer<typeof UnregisterPushTokenQueryDto>;
