import { Injectable } from "@nestjs/common";
import { CheerReader } from "../services/cheer.reader";
import { MarkCheerReadUseCase } from "../use-cases/mark-cheer-read/mark-cheer-read.use-case";
import { MarkManyCheersReadUseCase } from "../use-cases/mark-many-cheers-read/mark-many-cheers-read.use-case";
import {
	type SendCheerInput,
	SendCheerUseCase,
} from "../use-cases/send-cheer/send-cheer.use-case";

/** @deprecated HTTP 진입점은 endpoint UseCase를 직접 사용한다. */
@Injectable()
export class CheerFacade {
	constructor(
		private readonly reader: CheerReader,
		private readonly sendCheerUseCase: SendCheerUseCase,
		private readonly markCheerReadUseCase: MarkCheerReadUseCase,
		private readonly markManyCheersReadUseCase: MarkManyCheersReadUseCase,
	) {}
	sendCheer(input: SendCheerInput, timezone: string) {
		return this.sendCheerUseCase.execute(input, timezone);
	}
	getReceivedCheers(input: Parameters<CheerReader["getReceivedCheers"]>[0]) {
		return this.reader.getReceivedCheers(input);
	}
	getSentCheers(input: Parameters<CheerReader["getSentCheers"]>[0]) {
		return this.reader.getSentCheers(input);
	}
	getLimitInfo(userId: string, timezone: string) {
		return this.reader.getLimitInfo(userId, timezone);
	}
	getCooldownInfoForUser(senderId: string, receiverId: string) {
		return this.reader.getCooldownInfoForUser(senderId, receiverId);
	}
	markAsRead(userId: string, cheerId: number) {
		return this.markCheerReadUseCase.execute({ userId, cheerId });
	}
	markManyAsRead(userId: string, cheerIds: number[]) {
		return this.markManyCheersReadUseCase.execute({ userId, cheerIds });
	}
	countReceivedCheers(userId: string) {
		return this.reader.countReceivedCheers(userId);
	}
	countSentCheers(userId: string) {
		return this.reader.countSentCheers(userId);
	}
	countUnreadReceivedCheers(userId: string) {
		return this.reader.countUnreadReceivedCheers(userId);
	}
}
