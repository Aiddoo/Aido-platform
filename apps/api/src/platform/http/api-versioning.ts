import { type VersioningOptions, VersioningType } from "@nestjs/common";

export const API_VERSION = {
  V1: "1",
  V2: "2",
} as const;

export const API_VERSIONING_OPTIONS = {
  type: VersioningType.URI,
  defaultVersion: API_VERSION.V1,
} as const satisfies VersioningOptions;
