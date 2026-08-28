import { Inject, Injectable } from "@nestjs/common";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import {
	RETENTION_REPOSITORY,
	type RetentionRepositoryPort,
} from "../../ports/retention.repository.port";

@Injectable()
export class RecoverFailedRetentionDeliveryUseCase {
	constructor(
		@Inject(RETENTION_REPOSITORY) private readonly repository: RetentionRepositoryPort,
		@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
	) {}

	execute(input: {
		readonly outboxId: string;
		readonly publishAttempt?: number;
	}): Promise<boolean> {
		return this.uow.run(() =>
			this.repository.reopenUnclaimedDispatch({
				...input,
				availableAt: new Date(),
				reason: "RETENTION_RUNTIME_RETRIES_EXHAUSTED",
			}),
		);
	}
}
