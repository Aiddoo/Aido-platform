import { randomBytes } from "node:crypto";

/**
 * 사용자 태그 생성에 사용되는 문자 집합
 * 혼동 방지를 위해 0, O, 1, I, L 제외
 */
const USER_TAG_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const USER_TAG_LENGTH = 8;

/**
 * 8자리 고유 사용자 태그 생성
 * 해시태그처럼 다른 사용자가 검색할 수 있는 고유 식별자
 * @returns 8자리 영숫자 사용자 태그 (예: "ABC12DEF")
 */
export function generateUserTag(): string {
	const bytes = randomBytes(USER_TAG_LENGTH);
	let tag = "";
	for (let i = 0; i < USER_TAG_LENGTH; i++) {
		const byte = bytes[i] as number;
		tag += USER_TAG_ALPHABET[byte % USER_TAG_ALPHABET.length];
	}
	return tag;
}

/**
 * 사용자 태그 유효성 검사
 * @param tag 검사할 사용자 태그
 * @returns 유효한 태그인지 여부
 */
export function isValidUserTag(tag: string): boolean {
	if (tag.length !== USER_TAG_LENGTH) {
		return false;
	}
	for (const char of tag) {
		if (!USER_TAG_ALPHABET.includes(char)) {
			return false;
		}
	}
	return true;
}
