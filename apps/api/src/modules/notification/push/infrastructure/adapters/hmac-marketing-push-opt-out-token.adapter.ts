import { Inject, Injectable } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import { HmacTokenSigner } from "#api/platform/security/hmac-token-signer";
import { SigningKeyRing } from "#api/platform/security/signing-key-ring";

import type { MarketingPushOptOutTokenPort } from "../../application/ports/marketing-push-opt-out-token.port.js";
import { notificationPushConfig } from "../../notification-push.config.js";

const TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;
const TOKEN_DOMAIN = {
  legacyPrefix: "marketing-push-opt-out:",
  keyedPrefix: "marketing-push-opt-out:v2:",
};

@Injectable()
export class HmacMarketingPushOptOutTokenAdapter implements MarketingPushOptOutTokenPort {
  readonly #signer: HmacTokenSigner;

  constructor(
    @Inject(notificationPushConfig.KEY)
    config: Pick<ConfigType<typeof notificationPushConfig>, "optOutTokenSigning">,
  ) {
    const ring = SigningKeyRing.fromEnv(config.optOutTokenSigning);
    this.#signer = new HmacTokenSigner(ring, TOKEN_DOMAIN);
  }

  issue(userId: string): string {
    const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const payload = Buffer.from(`${userId}.${expiresAt}`).toString("base64url");
    return this.#signer.sign(payload);
  }

  verify(token: string): string | null {
    const payload = this.#signer.open(token);
    if (payload == null) {
      return null;
    }
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const separator = decoded.lastIndexOf(".");
    if (separator < 1) {
      return null;
    }
    const userId = decoded.slice(0, separator);
    const expiresAt = Number(decoded.slice(separator + 1));
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now() / 1000) {
      return null;
    }
    return userId;
  }
}
