import type { AppVersionResponse } from "@aido/api";

export const APP_VERSION_CONFIG = Symbol("APP_VERSION_CONFIG");

export interface AppVersionConfigPort {
  getAppVersion(): AppVersionResponse;
}
