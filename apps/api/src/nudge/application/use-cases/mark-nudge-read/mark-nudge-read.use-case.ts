import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { NUDGE_REPOSITORY, type NudgeRepositoryPort } from "../../ports/nudge.repository.port.js";

export interface MarkNudgeReadInput {
	userId: string;
	nudgeId: number;
}

/**
 * 콕 찌르기 읽음 처리 use-case.
 * 수신자 소유 검증 후 미읽음 콕 찌르기를 읽음 처리한다(이미 읽음이면 no-op).
 */
@Injectable()
export class MarkNudgeReadUseCase {
	readonly #logger = new Logger(MarkNudgeReadUseCase.name);

	constructor(
		@Inject(NUDGE_REPOSITORY)
		private readonly nudgeRepository: NudgeRepositoryPort,
	) {}

	async execute(input: MarkNudgeReadInput): Promise<void> {
		const { userId, nudgeId } = input;

		const nudge = await this.nudgeRepository.findById(nudgeId);
		if (!nudge?.isReceivedBy(userId)) {
			throw new ApplicationException(ErrorCode.NUDGE_1105, { nudgeId });
		}
		if (!nudge.markRead(now())) {
			return;
		}

		await this.nudgeRepository.saveRead(nudge);
		this.#logger.debug(`Nudge 읽음 처리: id=${nudgeId}`);
	}
}
