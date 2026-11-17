import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { match } from "ts-pattern";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";

import {
  type VerificationEmailCapBucket,
  VerificationEmailCapPort,
} from "../../application/ports/verification-email-cap.port.js";
import {
  VERIFICATION_EMAIL_CAP_TTL_MS,
  VerificationEmailCapKey,
} from "../cache/verification-email-cap.keyspace.js";

const SENT_ATS_SCHEMA = z.array(z.string());

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// @nestjs/throttler는 429 SYS_0001로 거절해 앱 타이머가 읽는 VERIFY_0753·remainingSeconds를 줄 수 없어 캐시로 센다
@Injectable()
export class VerificationEmailCapAdapter extends VerificationEmailCapPort {
  readonly #cacheService: CacheStorePort;

  constructor(cacheService: CacheStorePort) {
    super();
    this.#cacheService = cacheService;
  }

  async findSentAts(bucket: VerificationEmailCapBucket): Promise<readonly Temporal.Instant[]> {
    const stored = await this.#cacheService.get(this.#key(bucket), SENT_ATS_SCHEMA);
    return (stored ?? []).map((sentAt) => Temporal.Instant.from(sentAt));
  }

  async saveSentAts(
    bucket: VerificationEmailCapBucket,
    sentAts: readonly Temporal.Instant[],
  ): Promise<void> {
    await this.#cacheService.set(
      this.#key(bucket),
      sentAts.map((sentAt) => sentAt.toString()),
      VERIFICATION_EMAIL_CAP_TTL_MS,
    );
  }

  #key(bucket: VerificationEmailCapBucket): string {
    return match(bucket)
      .with({ scope: "email" }, ({ purpose, email }) =>
        VerificationEmailCapKey.email(purpose, sha256Hex(normalizeEmail(email))),
      )
      .with({ scope: "email-source" }, ({ purpose, email, sourceIp }) =>
        VerificationEmailCapKey.emailSource(
          purpose,
          sha256Hex(`${normalizeEmail(email)}\n${sourceIp}`),
        ),
      )
      .with({ scope: "user" }, ({ purpose, userId }) =>
        VerificationEmailCapKey.user(purpose, userId.value),
      )
      .exhaustive();
  }
}
