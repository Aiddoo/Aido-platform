import type { AppVersionResponse } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import {
  APP_VERSION_CONFIG,
  type AppVersionConfigPort,
} from "../../ports/app-version-config.port.js";

@Injectable()
export class GetAppVersionUseCase {
  constructor(@Inject(APP_VERSION_CONFIG) private readonly config: AppVersionConfigPort) {}

  execute(): AppVersionResponse {
    return this.config.getAppVersion();
  }
}
