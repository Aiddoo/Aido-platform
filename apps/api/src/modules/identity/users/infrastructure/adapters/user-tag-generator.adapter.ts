import { randomBytes } from "node:crypto";

import { USER_TAG_LENGTH } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";

import { UserTagGeneratorPort } from "../../application/ports/user-tag-generator.port.js";

const USER_TAG_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

@Injectable()
export class RandomUserTagGeneratorAdapter extends UserTagGeneratorPort {
  generate(): string {
    const bytes = randomBytes(USER_TAG_LENGTH);
    let userTag = "";
    for (const byte of bytes) {
      userTag += USER_TAG_ALPHABET[byte % USER_TAG_ALPHABET.length];
    }
    return userTag;
  }
}
