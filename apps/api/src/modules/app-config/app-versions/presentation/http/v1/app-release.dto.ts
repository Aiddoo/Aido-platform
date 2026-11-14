import {
  publishAppReleaseParamSchema,
  publishAppReleaseResponseSchema,
  publishAppReleaseSchema,
} from "@aido/api/contracts/app-config";
import type { z } from "zod";

export const PublishAppReleaseParamDto = publishAppReleaseParamSchema.meta({
  id: "PublishAppReleaseParamDto",
  apiParameter: true,
});
export type PublishAppReleaseParamDto = z.infer<typeof PublishAppReleaseParamDto>;

export const PublishAppReleaseDto = publishAppReleaseSchema.meta({ id: "PublishAppReleaseDto" });
export type PublishAppReleaseDto = z.infer<typeof PublishAppReleaseDto>;

export const PublishAppReleaseResponseDto = publishAppReleaseResponseSchema.meta({
  id: "PublishAppReleaseResponseDto",
});
export type PublishAppReleaseResponseDto = z.infer<typeof PublishAppReleaseResponseDto>;
