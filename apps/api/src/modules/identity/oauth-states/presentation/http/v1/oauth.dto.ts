import {
  exchangeCodeSchema,
  oauthStartQuerySchema,
  oauthWebCallbackQuerySchema,
} from "@aido/api/contracts/auth/v1";
import type { z } from "zod";

export const ExchangeCodeDto = exchangeCodeSchema.meta({ id: "ExchangeCodeDto" });
export type ExchangeCodeDto = z.infer<typeof ExchangeCodeDto>;
export const OAuthStartQueryDto = oauthStartQuerySchema.meta({
  id: "OAuthStartQueryDto",
  apiParameter: true,
});
export type OAuthStartQueryDto = z.infer<typeof OAuthStartQueryDto>;
export const OAuthWebCallbackQueryDto = oauthWebCallbackQuerySchema.meta({
  id: "OAuthWebCallbackQueryDto",
  apiParameter: true,
});
export type OAuthWebCallbackQueryDto = z.infer<typeof OAuthWebCallbackQueryDto>;
