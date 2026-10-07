import type { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { Feature } from "#api/modules/access/application/services/entitlement/entitlement.service";
import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import type { PaginationService } from "#api/shared/application/pagination/index";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

import {
  evaluateNudgeCooldown,
  evaluateRemindNudgeCooldown,
  type NudgeCooldown,
} from "../../../domain/services/nudges/nudge-cooldown.js";
import {
  type NudgeRepositoryPort,
  type NudgeWithRelations,
} from "../../ports/nudges/nudge.repository.port.js";

export interface NudgeLimitInfo {
  dailyLimit: number | null;
  used: number;
  remaining: number | null;
}

/** 목록 조회 파라미터 (정규화 전 — size 선택) */
export interface GetNudgesParams {
  userId: string;
  cursor?: number;
  size?: number;
}

/**
 * NudgeReader — 콕 찌르기 읽기 전용 서비스.
 *
 * 목록/한도/쿨다운 조회를 담당한다. 콕 찌르기 데이터는 변경이 잦고 커서 조합이 많아 캐싱하지 않는다
 * (레거시와 동일 — 캐시 낭비 방지).
 */
interface NudgeReaderDependencies {
  readonly nudgeRepository: NudgeRepositoryPort;
  readonly paginationService: PaginationService;
  readonly entitlementService: EntitlementService;
  readonly logger: ApplicationLogger;
}

export class NudgeReader {
  readonly #dependencies: NudgeReaderDependencies;

  constructor(dependencies: NudgeReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async getReceivedNudges(
    params: GetNudgesParams,
  ): Promise<CursorPaginatedResponse<NudgeWithRelations, number>> {
    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<number>(
      {
        cursor: params.cursor,
        size: params.size,
      },
    );

    const nudges = await this.#dependencies.nudgeRepository.findReceivedNudges({
      userId: params.userId,
      cursor,
      size,
    });

    this.#dependencies.logger.debug(
      `Received nudges listed: ${nudges.length} items for user: ${params.userId}`,
    );

    return this.#dependencies.paginationService.createCursorPaginatedResponse<
      NudgeWithRelations,
      number
    >({
      items: nudges,
      size,
    });
  }

  async getSentNudges(
    params: GetNudgesParams,
  ): Promise<CursorPaginatedResponse<NudgeWithRelations, number>> {
    const { cursor, size } = this.#dependencies.paginationService.normalizeCursorPagination<number>(
      {
        cursor: params.cursor,
        size: params.size,
      },
    );

    const nudges = await this.#dependencies.nudgeRepository.findSentNudges({
      userId: params.userId,
      cursor,
      size,
    });

    this.#dependencies.logger.debug(
      `Sent nudges listed: ${nudges.length} items for user: ${params.userId}`,
    );

    return this.#dependencies.paginationService.createCursorPaginatedResponse<
      NudgeWithRelations,
      number
    >({
      items: nudges,
      size,
    });
  }

  async getLimitInfo(userId: string, tz: string = "UTC"): Promise<NudgeLimitInfo> {
    const capturedAt = now();
    const quotaWindow = dayWindowInTimezone(capturedAt, tz);
    const { dailyLimit } = await this.#dependencies.entitlementService.getFeatureLimit(
      userId,
      Feature.NUDGE,
    );

    const used = await this.#dependencies.nudgeRepository.countSentSince(
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

  async getCooldownInfoForUser(senderId: string, receiverId: string): Promise<NudgeCooldown> {
    const lastNudge = await this.#dependencies.nudgeRepository.findLastNudgeToUser(
      senderId,
      receiverId,
    );
    return evaluateNudgeCooldown(lastNudge?.createdAt ?? null);
  }

  async getRemindCooldownInfo(senderId: string, receiverId: string): Promise<NudgeCooldown> {
    const lastRemind = await this.#dependencies.nudgeRepository.findLastRemindNudge(
      senderId,
      receiverId,
    );
    return evaluateRemindNudgeCooldown(lastRemind?.createdAt ?? null);
  }

  countReceivedNudges(userId: string): Promise<number> {
    return this.#dependencies.nudgeRepository.countReceived(userId);
  }

  countSentNudges(userId: string): Promise<number> {
    return this.#dependencies.nudgeRepository.countSent(userId);
  }

  countUnreadReceivedNudges(userId: string): Promise<number> {
    return this.#dependencies.nudgeRepository.countUnreadReceived(userId);
  }
}
