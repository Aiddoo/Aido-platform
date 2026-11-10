import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import { HmacTokenSigner } from "#api/platform/security/hmac-token-signer";
import { SigningKeyRing } from "#api/platform/security/signing-key-ring";

import type { MarketingPushOptOutTokenPort } from "../../../application/ports/delivery/marketing-push-opt-out-token.port.js";

const TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;
const TOKEN_DOMAIN = {
  legacyPrefix: "marketing-push-opt-out:",
  keyedPrefix: "marketing-push-opt-out:v2:",
};

@Injectable()
export class HmacMarketingPushOptOutTokenAdapter implements MarketingPushOptOutTokenPort {
  readonly #signer: HmacTokenSigner;

  constructor(config: TypedConfigService) {
    const ring = SigningKeyRing.fromEnv({
      configured: config.optOutTokenSigningKeys,
      legacySecret: config.jwtSecret,
    });
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
