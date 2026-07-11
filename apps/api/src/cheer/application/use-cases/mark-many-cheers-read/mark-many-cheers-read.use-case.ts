import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	CHEER_REPOSITORY,
	type CheerRepositoryPort,
} from "../../ports/cheer.repository.port";

export interface MarkManyCheersReadInput {
	userId: string;
	cheerIds: number[];
}

/**
 * 여러 응원 읽음 처리 use-case.
 * 수신자 소유 + 미읽음 조건으로 일괄 갱신하고 처리된 개수를 반환한다.
 */
@Injectable()
export class MarkManyCheersReadUseCase {
	readonly #logger = new Logger(MarkManyCheersReadUseCase.name);

	constructor(
		@Inject(CHEER_REPOSITORY)
		private readonly cheerRepository: CheerRepositoryPort,
	) {}

	async execute(input: MarkManyCheersReadInput): Promise<number> {
		const count = await this.cheerRepository.markManyAsRead(
			input.cheerIds,
			input.userId,
		);
		this.#logger.debug(`${count}건 응원 읽음 처리: user=${input.userId}`);
		return count;
	}
}
