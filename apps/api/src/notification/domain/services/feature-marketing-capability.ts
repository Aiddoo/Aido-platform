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

function isVersionAtLeast(version: string | null, minimumVersion: string): boolean {
	const current = parseVersion(version);
	const minimum = parseVersion(minimumVersion);
	if (!current || !minimum) return false;

	for (let index = 0; index < minimum.length; index += 1) {
		const currentPart = current[index] ?? 0;
		const minimumPart = minimum[index] ?? 0;
		if (currentPart > minimumPart) return true;
		if (currentPart < minimumPart) return false;
	}
	return true;
}

function parseVersion(version: string | null): number[] | null {
	if (!version) return null;
	const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
	if (!match) return null;
	return match.slice(1).map(Number);
}
