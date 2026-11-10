import type { AppVersionConfig } from "../read-models/app-version.read-model.js";

export const APP_VERSION_CONFIG = Symbol("APP_VERSION_CONFIG");

export interface AppVersionConfigPort {
  getAppVersion(): AppVersionConfig;
}
