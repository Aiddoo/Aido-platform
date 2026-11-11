import {
  marketingPushOptOutResponseSchema,
  marketingPushOptOutSchema,
  pushDeviceParamSchema,
  pushDeviceResponseSchema,
  registerPushTokenSchema,
  registerTokenResponseSchema,
  reportPushDeviceSchema,
  unregisterPushDeviceByTokenResponseSchema,
  unregisterPushDeviceByTokenSchema,
  unregisterPushTokenQuerySchema,
} from "@aido/api/contracts/notification";
import type { z } from "zod";

export const PushDeviceParamDto = pushDeviceParamSchema.meta({
  id: "PushDeviceParamDto",
  apiParameter: true,
});
export type PushDeviceParamDto = z.infer<typeof PushDeviceParamDto>;
export const ReportPushDeviceDto = reportPushDeviceSchema.meta({ id: "ReportPushDeviceDto" });
export type ReportPushDeviceDto = z.infer<typeof ReportPushDeviceDto>;
export const RegisterPushTokenDto = registerPushTokenSchema.meta({ id: "RegisterPushTokenDto" });
export type RegisterPushTokenDto = z.infer<typeof RegisterPushTokenDto>;
export const UnregisterPushTokenQueryDto = unregisterPushTokenQuerySchema.meta({
  id: "UnregisterPushTokenQueryDto",
  apiParameter: true,
});
export type UnregisterPushTokenQueryDto = z.infer<typeof UnregisterPushTokenQueryDto>;
export const UnregisterPushDeviceByTokenDto = unregisterPushDeviceByTokenSchema.meta({
  id: "UnregisterPushDeviceByTokenDto",
});
export type UnregisterPushDeviceByTokenDto = z.infer<typeof UnregisterPushDeviceByTokenDto>;
export const MarketingPushOptOutDto = marketingPushOptOutSchema.meta({
  id: "MarketingPushOptOutDto",
});
export type MarketingPushOptOutDto = z.infer<typeof MarketingPushOptOutDto>;

export const PushDeviceResponseDto = pushDeviceResponseSchema.meta({ id: "PushDeviceResponseDto" });
export type PushDeviceResponseDto = z.infer<typeof PushDeviceResponseDto>;
export const RegisterTokenResponseDto = registerTokenResponseSchema.meta({
  id: "RegisterTokenResponseDto",
});
export type RegisterTokenResponseDto = z.infer<typeof RegisterTokenResponseDto>;
export const MarketingPushOptOutResponseDto = marketingPushOptOutResponseSchema.meta({
  id: "MarketingPushOptOutResponseDto",
});
export type MarketingPushOptOutResponseDto = z.infer<typeof MarketingPushOptOutResponseDto>;
export const UnregisterPushDeviceByTokenResponseDto =
  unregisterPushDeviceByTokenResponseSchema.meta({ id: "UnregisterPushDeviceByTokenResponseDto" });
export type UnregisterPushDeviceByTokenResponseDto = z.infer<
  typeof UnregisterPushDeviceByTokenResponseDto
>;
