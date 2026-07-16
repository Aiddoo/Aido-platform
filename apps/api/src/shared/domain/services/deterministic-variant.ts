/**
 * 문자열 seed를 0..size-1 인덱스로 매핑한다.
 * FNV-1a 32-bit를 사용해 런타임과 재시도에 관계없이 결과를 고정한다.
 */
export function deterministicIndex(seed: string, size: number): number {
	if (size <= 1) return 0;
	let hash = 0x811c9dc5;
	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0) % size;
}
