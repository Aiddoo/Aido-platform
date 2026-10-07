import type { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { Feature } from "#api/modules/access/application/services/entitlement/entitlement.service";
import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import type { PaginationService } from "#api/shared/application/pagination/index";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

import {
  type CheerCooldown,
  evaluateCheerCooldown,
} from "../../../domain/services/cheers/cheer-cooldown.js";
import {
  type CheerRepositoryPort,
  type CheerWithRelations,
} from "../../ports/cheers/cheer.repository.port.js";

export interface CheerLimitInfo {
  dailyLimit: number | null;
  used: number;
  remaining: number | null;
}

/** 목록 조회 파라미터 (정규화 전 — size 선택) */
export interface GetCheersParams {
  userId: string;
  cursor?: number;
  size?: number;
}

/**
 * CheerReader — 응원 읽기 전용 서비스.
 *
 * 목록/한도/쿨다운 조회를 담당한다. 응원 데이터는 변경이 잦고 커서 조합이 많아 캐싱하지 않는다
 * (레거시와 동일 — 캐시 낭비 방지).
 */
interface CheerReaderDependencies {
  readonly cheerRepository: CheerRepositoryPort;
  readonly paginationService: PaginationService;
  readonly entitlementService: EntitlementService;
  readonly logger: ApplicationLogger;
}

export class CheerReader {
  readonly #dependencies: CheerReaderDependencies;

  constructor(dependencies: CheerReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async getReceivedCheers(
    params: GetCheersParams,
  ): Promise<CursorPaginatedResponse<CheerWithRelations, number>> {
    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<number>(
      {
        cursor: params.cursor,
        size: params.size,
      },
    );

    const cheers = await this.#dependencies.cheerRepository.findReceivedCheers({
      userId: params.userId,
      cursor,
      size,
    });

    this.#dependencies.logger.debug(
      `Received cheers listed: ${cheers.length} items for user: ${params.userId}`,
    );

    return this.#dependencies.paginationService.createCursorPaginatedResponse<
      CheerWithRelations,
      number
    >({
      items: cheers,
      size,
    });
  }

  async getSentCheers(
    params: GetCheersParams,
  ): Promise<CursorPaginatedResponse<CheerWithRelations, number>> {
    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<number>(
      {
        cursor: params.cursor,
        size: params.size,
      },
    );

    const cheers = await this.#dependencies.cheerRepository.findSentCheers({
      userId: params.userId,
      cursor,
      size,
    });

    this.#dependencies.logger.debug(
      `Sent cheers listed: ${cheers.length} items for user: ${params.userId}`,
    );

    return this.#dependencies.paginationService.createCursorPaginatedResponse<
      CheerWithRelations,
      number
    >({
      items: cheers,
      size,
    });
  }

  async getLimitInfo(userId: string, tz: string = "UTC"): Promise<CheerLimitInfo> {
    const capturedAt = now();
    const quotaWindow = dayWindowInTimezone(capturedAt, tz);
    const { dailyLimit } = await this.#dependencies.entitlementService.getFeatureLimit(
      userId,
      Feature.CHEER,
    );

    const used = await this.#dependencies.cheerRepository.countSentSince(
      userId,
      quotaWindow.startsAt,
      quotaWindow.endsAt,
    );

    return {
      dailyLimit,
      used,
      remaining: this.#dependencies.entitlementService.calculateRemaining(dailyLimit, used),
    };
  }

  async getCooldownInfoForUser(senderId: string, receiverId: string): Promise<CheerCooldown> {
    const lastCheer = await this.#dependencies.cheerRepository.findLastCheerToUser(
      senderId,
      receiverId,
    );
    return evaluateCheerCooldown(lastCheer?.createdAt ?? null);
  }

  countReceivedCheers(userId: string): Promise<number> {
    return this.#dependencies.cheerRepository.countReceived(userId);
  }

  countSentCheers(userId: string): Promise<number> {
    return this.#dependencies.cheerRepository.countSent(userId);
  }

  countUnreadReceivedCheers(userId: string): Promise<number> {
    return this.#dependencies.cheerRepository.countUnreadReceived(userId);
  }
}
