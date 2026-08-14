import { randomBytes } from "node:crypto";

const USER_TAG_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const USER_TAG_LENGTH = 8;

export function generateUserTag(): string {
	const bytes = randomBytes(USER_TAG_LENGTH);
	let userTag = "";
	for (const byte of bytes) {
		userTag += USER_TAG_ALPHABET[byte % USER_TAG_ALPHABET.length];
	}
	return userTag;
}
