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
	type CheerCooldown,
	evaluateCheerCooldown,
} from "../../domain/services/cheer-cooldown";
import {
	CHEER_REPOSITORY,
	type CheerRepositoryPort,
	type CheerWithRelations,
} from "../ports/cheer.repository.port";

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
@Injectable()
export class CheerReader {
	readonly #logger = new Logger(CheerReader.name);

	constructor(
		@Inject(CHEER_REPOSITORY)
		private readonly cheerRepository: CheerRepositoryPort,
		private readonly paginationService: PaginationService,
		private readonly entitlementService: EntitlementService,
	) {}

	async getReceivedCheers(
		params: GetCheersParams,
	): Promise<CursorPaginatedResponse<CheerWithRelations, number>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		const cheers = await this.cheerRepository.findReceivedCheers({
			userId: params.userId,
			cursor,
			size,
		});

		this.#logger.debug(
			`Received cheers listed: ${cheers.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<
			CheerWithRelations,
			number
		>({ items: cheers, size });
	}

	async getSentCheers(
		params: GetCheersParams,
	): Promise<CursorPaginatedResponse<CheerWithRelations, number>> {
		const { cursor, size } =
			this.paginationService.normalizeCursorPagination<number>({
				cursor: params.cursor,
				size: params.size,
			});

		const cheers = await this.cheerRepository.findSentCheers({
			userId: params.userId,
			cursor,
			size,
		});

		this.#logger.debug(
			`Sent cheers listed: ${cheers.length} items for user: ${params.userId}`,
		);

		return this.paginationService.createCursorPaginatedResponse<
			CheerWithRelations,
			number
		>({ items: cheers, size });
	}

	async getLimitInfo(
		userId: string,
		tz: string = "UTC",
	): Promise<CheerLimitInfo> {
		const { dailyLimit } = await this.entitlementService.getFeatureLimit(
			userId,
			Feature.CHEER,
		);

		const today = startOfDayInTimezone(now(), tz);
		const used = await this.cheerRepository.countTodayCheers(userId, today);

		return {
			dailyLimit,
			used,
			remaining: this.entitlementService.calculateRemaining(dailyLimit, used),
		};
	}

	async getCooldownInfoForUser(
		senderId: string,
		receiverId: string,
	): Promise<CheerCooldown> {
		const lastCheer = await this.cheerRepository.findLastCheerToUser(
			senderId,
			receiverId,
		);
		return evaluateCheerCooldown(lastCheer?.createdAt ?? null);
	}

	countReceivedCheers(userId: string): Promise<number> {
		return this.cheerRepository.countReceived(userId);
	}

	countSentCheers(userId: string): Promise<number> {
		return this.cheerRepository.countSent(userId);
	}

	countUnreadReceivedCheers(userId: string): Promise<number> {
		return this.cheerRepository.countUnreadReceived(userId);
	}
}
