import type { AppVersionResponse } from "@aido/validators";
import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import type { AppVersionConfigPort } from "../../application/ports/app-version-config.port";

@Injectable()
export class AppVersionConfigAdapter implements AppVersionConfigPort {
	constructor(private readonly config: TypedConfigService) {}

	getAppVersion(): AppVersionResponse {
		const value = this.config.appVersion;
		if (!value.enabled || !value.iosLatestVersion || !value.androidLatestVersion) {
			return { enabled: false };
		}
		return {
			enabled: true,
			ios: { latestVersion: value.iosLatestVersion },
			android: { latestVersion: value.androidLatestVersion },
		};
	}
}
