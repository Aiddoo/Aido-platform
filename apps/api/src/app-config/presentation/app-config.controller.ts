import type { FeatureDiscoveryResponse } from "@aido/validators";
import { Controller, Get, Header } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "@/auth/presentation/decorators";
import { RawResponse } from "@/shared/presentation/decorators";
import { ApiDoc } from "@/shared/presentation/swagger";
import { AppConfigFacade } from "../application/facades/app-config.facade";
import {
	FeatureDiscoveryDisabledResponseDto,
	FeatureDiscoveryEnabledResponseDto,
	featureDiscoveryResponseOpenApiSchema,
} from "./dtos";

@ApiTags("App Config")
@Controller("app-config")
export class AppConfigController {
	constructor(private readonly appConfigFacade: AppConfigFacade) {}

	@Get("feature-discovery")
	@Public()
	@RawResponse()
	@Header("Cache-Control", "public, max-age=300")
	@ApiDoc({
		summary: "Feature discovery rollout configuration",
		operationId: "getFeatureDiscoveryConfig",
		description:
			"Public kill-switch configuration only. Campaign copy and user data are never returned.",
	})
	@ApiExtraModels(
		FeatureDiscoveryDisabledResponseDto,
		FeatureDiscoveryEnabledResponseDto,
	)
	@ApiResponse({
		status: 200,
		description: "Feature discovery configuration",
		headers: {
			"Cache-Control": {
				description: "Publicly cacheable for five minutes",
				schema: {
					type: "string",
					example: "public, max-age=300",
				},
			},
		},
		schema: featureDiscoveryResponseOpenApiSchema,
	})
	getFeatureDiscovery(): FeatureDiscoveryResponse {
		return this.appConfigFacade.getFeatureDiscovery();
	}
}
