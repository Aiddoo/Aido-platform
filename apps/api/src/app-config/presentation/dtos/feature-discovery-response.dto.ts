import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Swagger projection of the shared Zod discriminated union.
 * Runtime contract validation remains in featureDiscoveryResponseSchema.
 */
export class FeatureDiscoveryResponseDto {
	@ApiProperty({ enum: [false, true] })
	declare enabled: boolean;

	@ApiPropertyOptional({ example: "feature-discovery-2026-08" })
	declare campaignId?: string;

	@ApiPropertyOptional({ example: "1.8.0" })
	declare minAppVersion?: string;

	@ApiPropertyOptional({ example: "2026-08-01T00:00:00.000Z" })
	declare launchedAt?: string;

	@ApiPropertyOptional({ example: true })
	declare autoOpen?: boolean;
}
