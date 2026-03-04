import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Queue } from "bullmq";
import { DatabaseService } from "@/database";

import { ACCOUNT_DELETION, SECURITY_EVENT } from "../constants/auth.constants";
import {
	ACCOUNT_PURGE_QUEUE,
	type AccountPurgeJobData,
	AccountPurgeProcessor,
} from "../processors/account-purge.processor";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { UserRepository } from "../repositories/user.repository";

/**
 * 계정 정리 스케줄러
 *
 * 매일 KST 03:00에 실행되어 유예 기간이 지난 soft-deleted 사용자를 hard delete합니다.
 * BullMQ Job Scheduler를 사용하여 Redis에 스케줄을 저장합니다.
 */
@Injectable()
export class AccountPurgeJob implements OnModuleInit {
	readonly #logger = new Logger(AccountPurgeJob.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly userRepository: UserRepository,
		private readonly securityLogRepository: SecurityLogRepository,
		@InjectQueue(ACCOUNT_PURGE_QUEUE)
		private readonly queue: Queue<AccountPurgeJobData>,
		private readonly processor: AccountPurgeProcessor,
	) {}

	async onModuleInit(): Promise<void> {
		// Processor에 자신을 등록 (순환 참조 방지)
		this.processor.setPurgeJob(this);

		await this.queue.upsertJobScheduler(
			"daily-account-purge-scheduler",
			{ pattern: "0 3 * * *", tz: "Asia/Seoul" },
			{ name: "purge-accounts", data: {} },
		);

		this.#logger.log("Account purge scheduler registered");
	}

	async purgeDeletedAccounts(): Promise<void> {
		this.#logger.log("Starting account purge...");

		const users = await this.userRepository.findSoftDeletedForPurge(
			ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
		);

		for (const user of users) {
			try {
				// Hard delete (cascade로 관련 데이터 정리)
				await this.database.$transaction(async (tx) => {
					await this.userRepository.hardDelete(user.id, tx);
				});

				// 트랜잭션 커밋 후 보안 로그 기록
				// NOTE: onDelete: SetNull에 의해 트랜잭션 내에서 생성하면 userId가 null이 되므로
				// 트랜잭션 밖에서 생성하고, metadata에 purgedUserId를 보관하여 감사 추적 보장
				await this.securityLogRepository.create({
					event: SECURITY_EVENT.ACCOUNT_HARD_DELETED,
					ipAddress: "SYSTEM",
					userAgent: "AccountPurgeJob",
					metadata: {
						purgedUserId: user.id,
						email: user.email,
						deletedAt: user.deletedAt.toISOString(),
					},
				});

				this.#logger.log(`Hard deleted user: ${user.id}`);
			} catch (error) {
				this.#logger.error(`Failed to hard delete user: ${user.id}`, error);
			}
		}

		if (users.length > 0) {
			this.#logger.log(`Purged ${users.length} deleted accounts`);
		}
	}
}
