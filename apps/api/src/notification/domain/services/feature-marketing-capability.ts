import { isVersionAtLeast } from "#api/shared/domain/version/compare-version";

export const FEATURE_DISCOVERY_CAMPAIGN_KEY = "feature-discovery-2026-08";
export const FEATURE_DISCOVERY_MIN_APP_VERSION = "1.8.0";

export interface PushCapability {
	readonly payloadVersion: number;
	readonly appVersion: string | null;
}

/** 기능 소개 마케팅 payload를 안전하게 해석할 수 있는 출시 클라이언트인지 판정한다. */
export function supportsFeatureDiscoveryMarketing(capability: PushCapability): boolean {
	return (
		capability.payloadVersion === 2 &&
		isVersionAtLeast(capability.appVersion, FEATURE_DISCOVERY_MIN_APP_VERSION)
	);
}
