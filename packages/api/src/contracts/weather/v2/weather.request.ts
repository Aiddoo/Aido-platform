import { z } from "zod";

import {
  GLOBAL_LATITUDE_RANGE,
  GLOBAL_LONGITUDE_RANGE,
} from "../../../vocabulary/weather.constants.js";

export const updateWeatherLocationSchema = z.object({
  latitude: z
    .number()
    .min(GLOBAL_LATITUDE_RANGE.MIN)
    .max(GLOBAL_LATITUDE_RANGE.MAX)
    .describe("위도 (WGS84, -90~90)"),
  longitude: z
    .number()
    .min(GLOBAL_LONGITUDE_RANGE.MIN)
    .max(GLOBAL_LONGITUDE_RANGE.MAX)
    .describe("경도 (WGS84, -180~180)"),
});

export type UpdateWeatherLocationInput = z.infer<typeof updateWeatherLocationSchema>;
