export const CACHE_KEY_PREFIX = "aido:v1";

function segment(value: string, label: string): string {
	if (value.trim().length === 0) {
		throw new Error(`${label} cache key segment must not be blank`);
	}
	if (value.includes("*")) {
		throw new Error(`${label} cache key segment must not contain wildcard`);
	}
	return encodeURIComponent(value);
}

/** 모든 cache/dedup/lock backend가 공유하는 충돌 없는 버전 키를 만든다. */
export function cacheKey(
	context: string,
	resource: string,
	...identifiers: readonly string[]
): string {
	return [
		CACHE_KEY_PREFIX,
		segment(context, "context"),
		segment(resource, "resource"),
		...identifiers.map((identifier) => segment(identifier, "identifier")),
	].join(":");
}

/** prefix deletion 용도로만 마지막 wildcard를 허용한다. */
export function cachePattern(
	context: string,
	resource: string,
	...identifiers: readonly string[]
): string {
	return `${cacheKey(context, resource, ...identifiers)}:*`;
}
