import { createHash } from "node:crypto";

import { VERIFICATION_CODE } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";

import { PasswordResetCooldownPort } from "../../application/ports/password-reset-cooldown.port.js";
import {
  PASSWORD_RESET_COOLDOWN_TTL_MS,
  PasswordResetCooldownKey,
} from "../cache/password-reset-cooldown.keyspace.js";

const STARTED_AT_SCHEMA = z.string();

// @nestjs/throttler는 429 SYS_0001로 거절해 앱 타이머가 읽는 VERIFY_0753·remainingSeconds를 줄 수 없어 캐시로 센다.
// 읽고 쓰기가 원자적이지 않지만 동시 요청은 가입 여부와 상관없이 같은 응답이다
@Injectable()
export class PasswordResetCooldownAdapter extends PasswordResetCooldownPort {
  readonly #cacheService: CacheStorePort;

  constructor(cacheService: CacheStorePort) {
    super();
    this.#cacheService = cacheService;
  }

  async findStartedAt(email: string, now: Temporal.Instant): Promise<Temporal.Instant | null> {
    const stored = await this.#cacheService.get(this.#key(email), STARTED_AT_SCHEMA);
    if (stored == null) {
      return null;
    }
    const startedAt = Temporal.Instant.from(stored);
    const endsAt = startedAt.add({ seconds: VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS });
    return Temporal.Instant.compare(now, endsAt) < 0 ? startedAt : null;
  }

  async start(email: string, now: Temporal.Instant): Promise<void> {
    await this.#cacheService.set(this.#key(email), now.toString(), PASSWORD_RESET_COOLDOWN_TTL_MS);
  }

  #key(email: string): string {
    const digest = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
    return PasswordResetCooldownKey.email(digest);
  }
}
