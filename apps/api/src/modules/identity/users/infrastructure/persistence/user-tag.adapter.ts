import { randomBytes } from "node:crypto";

import { USER_TAG_LENGTH } from "@aido/api/vocabulary";

const USER_TAG_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateUserTag(): string {
  const bytes = randomBytes(USER_TAG_LENGTH);
  let userTag = "";
  for (const byte of bytes) {
    userTag += USER_TAG_ALPHABET[byte % USER_TAG_ALPHABET.length];
  }
  return userTag;
}
