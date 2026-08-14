import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { CHEER_REPOSITORY, type CheerRepositoryPort } from "../../ports/cheer.repository.port";

export interface MarkCheerReadInput {
	userId: string;
	cheerId: number;
}

/**
 * 응원 읽음 처리 use-case.
 * 수신자 소유 검증 후 미읽음 응원을 읽음 처리한다(이미 읽음이면 no-op).
 */
@Injectable()
export class MarkCheerReadUseCase {
	readonly #logger = new Logger(MarkCheerReadUseCase.name);

	constructor(
		@Inject(CHEER_REPOSITORY)
		private readonly cheerRepository: CheerRepositoryPort,
	) {}

	async execute(input: MarkCheerReadInput): Promise<void> {
		const { userId, cheerId } = input;

		const cheer = await this.cheerRepository.findById(cheerId);
		if (!cheer?.isReceivedBy(userId)) {
			throw new ApplicationException(ErrorCode.CHEER_1205, { cheerId });
		}
		if (cheer.isRead()) {
			return;
		}

		await this.cheerRepository.markAsRead(cheerId);
		this.#logger.debug(`Cheer 읽음 처리: id=${cheerId}`);
	}
}
