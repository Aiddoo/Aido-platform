import { Injectable } from "@nestjs/common";
import { NudgeReader } from "../services/nudge.reader";
import { MarkNudgeReadUseCase } from "../use-cases/mark-nudge-read/mark-nudge-read.use-case";
import {
	type SendNudgeInput,
	SendNudgeUseCase,
} from "../use-cases/send-nudge/send-nudge.use-case";
import {
	type SendRemindNudgeInput,
	SendRemindNudgeUseCase,
} from "../use-cases/send-remind-nudge/send-remind-nudge.use-case";

/** @deprecated HTTP 진입점은 endpoint UseCase를 직접 사용한다. */
@Injectable()
export class NudgeFacade {
	constructor(
		private readonly reader: NudgeReader,
		private readonly sendNudgeUseCase: SendNudgeUseCase,
		private readonly sendRemindNudgeUseCase: SendRemindNudgeUseCase,
		private readonly markNudgeReadUseCase: MarkNudgeReadUseCase,
	) {}
	sendNudge(input: SendNudgeInput, timezone: string) {
		return this.sendNudgeUseCase.execute(input, timezone);
	}
	sendRemindNudge(input: SendRemindNudgeInput, timezone: string) {
		return this.sendRemindNudgeUseCase.execute(input, timezone);
	}
	getReceivedNudges(input: Parameters<NudgeReader["getReceivedNudges"]>[0]) {
		return this.reader.getReceivedNudges(input);
	}
	getSentNudges(input: Parameters<NudgeReader["getSentNudges"]>[0]) {
		return this.reader.getSentNudges(input);
	}
	getLimitInfo(userId: string, timezone: string) {
		return this.reader.getLimitInfo(userId, timezone);
	}
	getCooldownInfoForUser(senderId: string, receiverId: string) {
		return this.reader.getCooldownInfoForUser(senderId, receiverId);
	}
	getRemindCooldownInfo(senderId: string, receiverId: string) {
		return this.reader.getRemindCooldownInfo(senderId, receiverId);
	}
	markAsRead(userId: string, nudgeId: number) {
		return this.markNudgeReadUseCase.execute({ userId, nudgeId });
	}
	countReceivedNudges(userId: string) {
		return this.reader.countReceivedNudges(userId);
	}
	countSentNudges(userId: string) {
		return this.reader.countSentNudges(userId);
	}
	countUnreadReceivedNudges(userId: string) {
		return this.reader.countUnreadReceivedNudges(userId);
	}
}
