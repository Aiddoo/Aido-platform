import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { DatabaseService } from "@/database";

import { ACCOUNT_DELETION, SECURITY_EVENT } from "../constants/auth.constants";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { UserRepository } from "../repositories/user.repository";

@Injectable()
export class AccountPurgeJob {
	private readonly logger = new Logger(AccountPurgeJob.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly userRepository: UserRepository,
		private readonly securityLogRepository: SecurityLogRepository,
	) {}

	@Cron(CronExpression.EVERY_DAY_AT_3AM)
	async purgeDeletedAccounts(): Promise<void> {
		const users = await this.userRepository.findSoftDeletedForPurge(
			ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
		);

		for (const user of users) {
			try {
				await this.database.$transaction(async (tx) => {
					await this.securityLogRepository.create(
						{
							userId: user.id,
							event: SECURITY_EVENT.ACCOUNT_HARD_DELETED,
							ipAddress: "SYSTEM",
							userAgent: "AccountPurgeJob",
							metadata: {
								email: user.email,
								deletedAt: user.deletedAt.toISOString(),
							},
						},
						tx,
					);
					await this.userRepository.hardDelete(user.id, tx);
				});
				this.logger.log(`Hard deleted user: ${user.id}`);
			} catch (error) {
				this.logger.error(`Failed to hard delete user: ${user.id}`, error);
			}
		}

		if (users.length > 0) {
			this.logger.log(`Purged ${users.length} deleted accounts`);
		}
	}
}
