import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import type {
  PremiumAccess,
  PremiumAccessReaderPort,
} from "../../application/ports/premium-access.reader.port.js";
import { GetPremiumAccessUseCase } from "../../application/use-cases/get-premium-access.use-case.js";

function toDateOrNull(instant: Temporal.Instant | null): Date | null {
  return instant == null ? null : instantToDate(instant);
}

// 다른 Context는 아직 Date를 쓰므로 이 경계에서 시각 형식을 바꾼다
@Injectable()
export class PremiumAccessReaderAdapter implements PremiumAccessReaderPort {
  readonly #getPremiumAccess: Pick<GetPremiumAccessUseCase, "execute">;

  constructor(getPremiumAccess: GetPremiumAccessUseCase) {
    this.#getPremiumAccess = getPremiumAccess;
  }

  async getPremiumAccess(userId: UserId): Promise<PremiumAccess> {
    const access = await this.#getPremiumAccess.execute({ userId: userId.value });
    return {
      ...access,
      endsAt: toDateOrNull(access.endsAt),
      periodEndsAt: toDateOrNull(access.periodEndsAt),
      recentGrantEndedAt: toDateOrNull(access.recentGrantEndedAt),
    };
  }
}
