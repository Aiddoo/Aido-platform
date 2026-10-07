import { registerTokenResponseSchema } from "@aido/api";
import type { z } from "zod";

export const RegisterTokenResponseDto = registerTokenResponseSchema.meta({
  id: "RegisterTokenResponseDto",
});
export type RegisterTokenResponseDto = z.infer<typeof RegisterTokenResponseDto>;
