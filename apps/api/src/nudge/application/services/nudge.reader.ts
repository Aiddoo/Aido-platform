import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	EntitlementService,
	Feature,
} from "@/shared/application/entitlement/entitlement.service";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { PaginationService } from "@/shared/application/pagination";
import { now } from "@/shared/domain/date/utils/core";
import { startOfDayInTimezone } from "@/shared/domain/date/utils/timezone";

import {
	evaluateNudgeCooldown,
	evaluateRemindNudgeCooldown,
	type NudgeCooldown,
} from "../../domain/services/nudge-cooldown";
import {
	NUDGE_REPOSITORY,
	type NudgeRepositoryPort,
	type NudgeWithRelations,
} from "../ports/nudge.repository.port";

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
@Injectable()
export class NudgeReader {
	readonly #logger = new Logger(NudgeReader.name);

	constructor(
		@Inject(NUDGE_REPOSITORY)
		private readonly nudgeRepository: NudgeRepositoryPort,
		private readonly paginationService: PaginationService,
		private readonly entitlementService: EntitlementService,
	) {}

	async getReceivedNudges(
		params: GetNudgesParams,
	): Promise<CursorPaginatedResponse<NudgeWithRelations, number>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		const nudges = await this.nudgeRepository.findReceivedNudges({
			userId: params.userId,
			cursor,
			size,
		});

		this.#logger.debug(
			`Received nudges listed: ${nudges.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<
			NudgeWithRelations,
			number
		>({ items: nudges, size });
	}

	async getSentNudges(
		params: GetNudgesParams,
	): Promise<CursorPaginatedResponse<NudgeWithRelations, number>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		const nudges = await this.nudgeRepository.findSentNudges({
			userId: params.userId,
			cursor,
			size,
		});

		this.#logger.debug(
			`Sent nudges listed: ${nudges.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<
			NudgeWithRelations,
			number
		>({ items: nudges, size });
	}

	async getLimitInfo(
		userId: string,
		tz: string = "UTC",
	): Promise<NudgeLimitInfo> {
		const { dailyLimit } = await this.entitlementService.getFeatureLimit(
			userId,
			Feature.NUDGE,
		);

		const today = startOfDayInTimezone(now(), tz);
		const used = await this.nudgeRepository.countTodayNudges(userId, today);

		return {
			dailyLimit,
			used,
			remaining: this.entitlementService.calculateRemaining(dailyLimit, used),
		};
	}

	async getCooldownInfoForUser(
		senderId: string,
		receiverId: string,
	): Promise<NudgeCooldown> {
		const lastNudge = await this.nudgeRepository.findLastNudgeToUser(
			senderId,
			receiverId,
		);
		return evaluateNudgeCooldown(lastNudge?.createdAt ?? null);
	}

	async getRemindCooldownInfo(
		senderId: string,
		receiverId: string,
	): Promise<NudgeCooldown> {
		const lastRemind = await this.nudgeRepository.findLastRemindNudge(
			senderId,
			receiverId,
		);
		return evaluateRemindNudgeCooldown(lastRemind?.createdAt ?? null);
	}

	countReceivedNudges(userId: string): Promise<number> {
		return this.nudgeRepository.countReceived(userId);
	}

	countSentNudges(userId: string): Promise<number> {
		return this.nudgeRepository.countSent(userId);
	}

	countUnreadReceivedNudges(userId: string): Promise<number> {
		return this.nudgeRepository.countUnreadReceived(userId);
	}
}
