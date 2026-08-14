import type { FeatureDiscoveryResponse } from "@aido/validators";
import { Controller, Get, Header } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "@/auth/presentation/decorators";
import { RawResponse } from "@/shared/presentation/decorators";
import { ApiDoc } from "@/shared/presentation/swagger";
import { GetFeatureDiscoveryUseCase } from "../application/queries/get-feature-discovery/get-feature-discovery.use-case";
import {
	FeatureDiscoveryDisabledResponseDto,
	FeatureDiscoveryEnabledResponseDto,
	featureDiscoveryResponseOpenApiSchema,
} from "./dtos";

@ApiTags("App Config")
@Controller("app-config")
export class AppConfigController {
	constructor(
		private readonly getFeatureDiscoveryUseCase: GetFeatureDiscoveryUseCase,
	) {}

	@Get("feature-discovery")
	@Public()
	@RawResponse()
	@Header("Cache-Control", "private, no-store")
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
				description:
					"Not cached so the operational kill switch is reflected on the next request",
				schema: {
					type: "string",
					example: "private, no-store",
				},
			},
		},
		schema: featureDiscoveryResponseOpenApiSchema,
	})
	getFeatureDiscovery(): FeatureDiscoveryResponse {
		return this.getFeatureDiscoveryUseCase.execute();
	}
}
