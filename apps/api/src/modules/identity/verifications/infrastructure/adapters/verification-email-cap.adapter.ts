import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";

import { VerificationEmailCapPort } from "../../application/ports/verification-email-cap.port.js";
import {
  VERIFICATION_EMAIL_CAP_TTL_MS,
  VerificationEmailCapKey,
} from "../cache/verification-email-cap.keyspace.js";

const SENT_ATS_SCHEMA = z.array(z.string());

// @nestjs/throttler는 429 SYS_0001로 거절해 앱 타이머가 읽는 VERIFY_0753·remainingSeconds를 줄 수 없어 캐시로 센다
@Injectable()
export class VerificationEmailCapAdapter extends VerificationEmailCapPort {
  readonly #cacheService: CacheStorePort;

  constructor(cacheService: CacheStorePort) {
    super();
    this.#cacheService = cacheService;
  }

  async findSentAts(email: string): Promise<readonly Temporal.Instant[]> {
    const stored = await this.#cacheService.get(this.#key(email), SENT_ATS_SCHEMA);
    return (stored ?? []).map((sentAt) => Temporal.Instant.from(sentAt));
  }

  async saveSentAts(email: string, sentAts: readonly Temporal.Instant[]): Promise<void> {
    await this.#cacheService.set(
      this.#key(email),
      sentAts.map((sentAt) => sentAt.toString()),
      VERIFICATION_EMAIL_CAP_TTL_MS,
    );
  }

  #key(email: string): string {
    const digest = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
    return VerificationEmailCapKey.email(digest);
  }
}
