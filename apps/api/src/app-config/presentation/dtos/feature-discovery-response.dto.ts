import {
	featureDiscoveryMinAppVersionPattern,
	featureDiscoveryUtcDateTimePattern,
} from "@aido/validators";
import { ApiProperty } from "@nestjs/swagger";

export class FeatureDiscoveryDisabledResponseDto {
	@ApiProperty({ enum: [false] })
	declare enabled: false;
}

export class FeatureDiscoveryEnabledResponseDto {
	@ApiProperty({ enum: [true] })
	declare enabled: true;

	@ApiProperty({ example: "feature-discovery-2026-08" })
	declare campaignId: string;

	@ApiProperty({ example: "1.8.0" })
	declare minAppVersion: string;

	@ApiProperty({ example: "2026-08-01T00:00:00.000Z" })
	declare launchedAt: string;

	@ApiProperty({ example: true })
	declare autoOpen: boolean;
}

const featureDiscoveryDisabledSchema = {
	title: "FeatureDiscoveryDisabledResponse",
	type: "object",
	additionalProperties: false,
	required: ["enabled"],
	properties: {
		enabled: { type: "boolean", enum: [false] },
	},
};

const featureDiscoveryEnabledSchema = {
	title: "FeatureDiscoveryEnabledResponse",
	type: "object",
	additionalProperties: false,
	required: [
		"enabled",
		"campaignId",
		"minAppVersion",
		"launchedAt",
		"autoOpen",
	],
	properties: {
		enabled: { type: "boolean", enum: [true] },
		campaignId: { type: "string", minLength: 1 },
		minAppVersion: {
			type: "string",
			pattern: featureDiscoveryMinAppVersionPattern,
		},
		launchedAt: {
			type: "string",
			format: "date-time",
			pattern: featureDiscoveryUtcDateTimePattern,
		},
		autoOpen: { type: "boolean" },
	},
};

/** Direct wire schema matching @aido/validators' strict discriminated union. */
export const featureDiscoveryResponseOpenApiSchema = {
	oneOf: [featureDiscoveryDisabledSchema, featureDiscoveryEnabledSchema],
	discriminator: {
		propertyName: "enabled",
	},
};
