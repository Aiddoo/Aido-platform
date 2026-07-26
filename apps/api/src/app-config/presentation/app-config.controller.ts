import type { FeatureDiscoveryResponse } from "@aido/validators";
import { Controller, Get, Header } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "@/auth/presentation/decorators";
import { ApiDoc, ApiSuccessResponse } from "@/shared/presentation/swagger";
import { AppConfigFacade } from "../application/facades/app-config.facade";
import { FeatureDiscoveryResponseDto } from "./dtos";

@ApiTags("App Config")
@Controller("app-config")
export class AppConfigController {
	constructor(private readonly appConfigFacade: AppConfigFacade) {}

	@Get("feature-discovery")
	@Public()
	@Header("Cache-Control", "public, max-age=300")
	@ApiDoc({
		summary: "Feature discovery rollout configuration",
		operationId: "getFeatureDiscoveryConfig",
		description:
			"Public kill-switch configuration only. Campaign copy and user data are never returned.",
	})
	@ApiSuccessResponse({ type: FeatureDiscoveryResponseDto })
	getFeatureDiscovery(): FeatureDiscoveryResponse {
		return this.appConfigFacade.getFeatureDiscovery();
	}
}
