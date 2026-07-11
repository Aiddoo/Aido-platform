import { Injectable } from "@nestjs/common";

import type { CursorPaginatedResponse } from "@/shared/application/pagination";

import type { CheerCooldown } from "../../domain/services/cheer-cooldown";
import type { CheerWithRelations } from "../ports/cheer.repository.port";
import {
	type CheerLimitInfo,
	CheerReader,
	type GetCheersParams,
} from "../services/cheer.reader";
import { MarkCheerReadUseCase } from "../use-cases/mark-cheer-read/mark-cheer-read.use-case";
import { MarkManyCheersReadUseCase } from "../use-cases/mark-many-cheers-read/mark-many-cheers-read.use-case";
import {
	type SendCheerInput,
	SendCheerUseCase,
} from "../use-cases/send-cheer/send-cheer.use-case";

/**
 * CheerFacade — cheer 모듈의 유일한 공개 표면.
 * 컨트롤러는 이 파사드만 주입하며, 파사드는 use-case·reader에 직접 위임한다(버스 없음).
 */
@Injectable()
export class CheerFacade {
	constructor(
		private readonly reader: CheerReader,
		private readonly sendCheerUseCase: SendCheerUseCase,
		private readonly markCheerReadUseCase: MarkCheerReadUseCase,
		private readonly markManyCheersReadUseCase: MarkManyCheersReadUseCase,
	) {}

	sendCheer(input: SendCheerInput, tz: string): Promise<CheerWithRelations> {
		return this.sendCheerUseCase.execute(input, tz);
	}

	getReceivedCheers(
		params: GetCheersParams,
	): Promise<CursorPaginatedResponse<CheerWithRelations, number>> {
		return this.reader.getReceivedCheers(params);
	}

	getSentCheers(
		params: GetCheersParams,
	): Promise<CursorPaginatedResponse<CheerWithRelations, number>> {
		return this.reader.getSentCheers(params);
	}

	getLimitInfo(userId: string, tz: string): Promise<CheerLimitInfo> {
		return this.reader.getLimitInfo(userId, tz);
	}

	getCooldownInfoForUser(
		senderId: string,
		receiverId: string,
	): Promise<CheerCooldown> {
		return this.reader.getCooldownInfoForUser(senderId, receiverId);
	}

	markAsRead(userId: string, cheerId: number): Promise<void> {
		return this.markCheerReadUseCase.execute({ userId, cheerId });
	}

	markManyAsRead(userId: string, cheerIds: number[]): Promise<number> {
		return this.markManyCheersReadUseCase.execute({ userId, cheerIds });
	}

	countReceivedCheers(userId: string): Promise<number> {
		return this.reader.countReceivedCheers(userId);
	}

	countSentCheers(userId: string): Promise<number> {
		return this.reader.countSentCheers(userId);
	}

	countUnreadReceivedCheers(userId: string): Promise<number> {
		return this.reader.countUnreadReceivedCheers(userId);
	}
}
