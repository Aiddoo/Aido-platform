export function isVersionAtLeast(version: string | null, minimumVersion: string): boolean {
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
