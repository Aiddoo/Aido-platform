import { Injectable } from "@nestjs/common";

import {
  EntitlementService,
  Feature,
} from "#api/modules/access/application/services/entitlement/entitlement.service";

import type { NudgeLimitReaderPort } from "../../../application/ports/nudges/nudge-limit-reader.port.js";

/**
 * NudgeLimitReaderPort의 어댑터.
 *
 * 활성 트랜잭션 클라이언트(TransactionHost.tx)로 EntitlementService의 실시간(비캐시) 한도 조회를
 * 수행한다. 트랜잭션 클라이언트 접근이라는 인프라 관심사를 여기서 캡슐화한다(TOCTOU 방지).
 */
@Injectable()
export class NudgeLimitReaderAdapter implements NudgeLimitReaderPort {
  constructor(private readonly entitlementService: EntitlementService) {}

  async getDailyLimitInTx(userId: string): Promise<number | null> {
    const { dailyLimit } = await this.entitlementService.getFeatureLimitInTx(userId, Feature.NUDGE);
    return dailyLimit;
  }
}
