import { type VersioningOptions, VersioningType } from "@nestjs/common";

export const API_VERSION = {
  V1: "1",
  V2: "2",
} as const;

export type ApiVersion = (typeof API_VERSION)[keyof typeof API_VERSION];

export const API_VERSIONING_OPTIONS = {
  type: VersioningType.URI,
  defaultVersion: API_VERSION.V1,
} as const satisfies VersioningOptions;
