import type { RetentionVariant } from "../retention.constants";

/** 사용자별로 영구히 안정적인 실험군을 선택한다. */
export function assignRetentionVariant(
	userId: string,
	treatmentPercent: number,
): RetentionVariant {
	let hash = 2_166_136_261;
	for (const character of userId) {
		hash ^= character.charCodeAt(0);
		hash = Math.imul(hash, 16_777_619);
	}
	const bucket = (hash >>> 0) % 100;
	return bucket < treatmentPercent ? "TREATMENT" : "CONTROL";
}
