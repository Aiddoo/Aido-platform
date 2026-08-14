import { createHmac, timingSafeEqual } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import type { MarketingPushOptOutTokenPort } from "../../application/ports/marketing-push-opt-out-token.port";

const TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;

@Injectable()
export class HmacMarketingPushOptOutTokenAdapter implements MarketingPushOptOutTokenPort {
	constructor(private readonly config: TypedConfigService) {}

	issue(userId: string): string {
		const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
		const payload = Buffer.from(`${userId}.${expiresAt}`).toString("base64url");
		return `${payload}.${this.#sign(payload)}`;
	}

	verify(token: string): string | null {
		const [payload, signature] = token.split(".");
		if (!payload || !signature) return null;
		const expected = this.#sign(payload);
		const actualBuffer = Buffer.from(signature);
		const expectedBuffer = Buffer.from(expected);
		if (
			actualBuffer.length !== expectedBuffer.length ||
			!timingSafeEqual(actualBuffer, expectedBuffer)
		) {
			return null;
		}
		const decoded = Buffer.from(payload, "base64url").toString("utf8");
		const separator = decoded.lastIndexOf(".");
		if (separator < 1) return null;
		const userId = decoded.slice(0, separator);
		const expiresAt = Number(decoded.slice(separator + 1));
		if (!Number.isFinite(expiresAt) || expiresAt < Date.now() / 1000) return null;
		return userId;
	}

	#sign(payload: string): string {
		return createHmac("sha256", this.config.jwtSecret)
			.update(`marketing-push-opt-out:${payload}`)
			.digest("base64url");
	}
}
