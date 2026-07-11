import { Injectable } from "@nestjs/common";

import type { CursorPaginatedResponse } from "@/shared/application/pagination";

import type { NudgeCooldown } from "../../domain/services/nudge-cooldown";
import type {
	NudgeWithRelations,
	ReminderNudgeWithRelations,
} from "../ports/nudge.repository.port";
import {
	type GetNudgesParams,
	type NudgeLimitInfo,
	NudgeReader,
} from "../services/nudge.reader";
import { MarkNudgeReadUseCase } from "../use-cases/mark-nudge-read/mark-nudge-read.use-case";
import {
	type SendNudgeInput,
	SendNudgeUseCase,
} from "../use-cases/send-nudge/send-nudge.use-case";
import {
	type SendRemindNudgeInput,
	SendRemindNudgeUseCase,
} from "../use-cases/send-remind-nudge/send-remind-nudge.use-case";

/**
 * NudgeFacade — nudge 모듈의 유일한 공개 표면.
 * 컨트롤러는 이 파사드만 주입하며, 파사드는 use-case·reader에 직접 위임한다(버스 없음).
 */
@Injectable()
export class NudgeFacade {
	constructor(
		private readonly reader: NudgeReader,
		private readonly sendNudgeUseCase: SendNudgeUseCase,
		private readonly sendRemindNudgeUseCase: SendRemindNudgeUseCase,
		private readonly markNudgeReadUseCase: MarkNudgeReadUseCase,
	) {}

	sendNudge(input: SendNudgeInput, tz: string): Promise<NudgeWithRelations> {
		return this.sendNudgeUseCase.execute(input, tz);
	}

	sendRemindNudge(
		input: SendRemindNudgeInput,
		tz: string,
	): Promise<ReminderNudgeWithRelations> {
		return this.sendRemindNudgeUseCase.execute(input, tz);
	}

	getReceivedNudges(
		params: GetNudgesParams,
	): Promise<CursorPaginatedResponse<NudgeWithRelations, number>> {
		return this.reader.getReceivedNudges(params);
	}

	getSentNudges(
		params: GetNudgesParams,
	): Promise<CursorPaginatedResponse<NudgeWithRelations, number>> {
		return this.reader.getSentNudges(params);
	}

	getLimitInfo(userId: string, tz: string): Promise<NudgeLimitInfo> {
		return this.reader.getLimitInfo(userId, tz);
	}

	getCooldownInfoForUser(
		senderId: string,
		receiverId: string,
	): Promise<NudgeCooldown> {
		return this.reader.getCooldownInfoForUser(senderId, receiverId);
	}

	getRemindCooldownInfo(
		senderId: string,
		receiverId: string,
	): Promise<NudgeCooldown> {
		return this.reader.getRemindCooldownInfo(senderId, receiverId);
	}

	markAsRead(userId: string, nudgeId: number): Promise<void> {
		return this.markNudgeReadUseCase.execute({ userId, nudgeId });
	}

	countReceivedNudges(userId: string): Promise<number> {
		return this.reader.countReceivedNudges(userId);
	}

	countSentNudges(userId: string): Promise<number> {
		return this.reader.countSentNudges(userId);
	}

	countUnreadReceivedNudges(userId: string): Promise<number> {
		return this.reader.countUnreadReceivedNudges(userId);
	}
}
