import { pushDeviceParamSchema, reportPushDeviceSchema } from "@aido/api";
import type { z } from "zod";

export const PushDeviceParamDto = pushDeviceParamSchema.meta({
  id: "PushDeviceParamDto",
  apiParameter: true,
});
export type PushDeviceParamDto = z.infer<typeof PushDeviceParamDto>;

export const ReportPushDeviceDto = reportPushDeviceSchema.meta({ id: "ReportPushDeviceDto" });
export type ReportPushDeviceDto = z.infer<typeof ReportPushDeviceDto>;
