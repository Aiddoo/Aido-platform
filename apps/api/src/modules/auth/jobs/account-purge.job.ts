import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
	type ILockProvider,
	LOCK_PROVIDER,
} from "@/common/lock/interfaces/lock.interface";
import { DatabaseService } from "@/database";

import { ACCOUNT_DELETION, SECURITY_EVENT } from "../constants/auth.constants";
import { SecurityLogRepository } from "../repositories/security-log.repository";
import { UserRepository } from "../repositories/user.repository";

const PURGE_LOCK_KEY = "cron:account-purge";
const PURGE_LOCK_TTL_MS = 5 * 60 * 1000; // 5분

@Injectable()
export class AccountPurgeJob implements OnModuleInit {
	readonly #logger = new Logger(AccountPurgeJob.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly userRepository: UserRepository,
		private readonly securityLogRepository: SecurityLogRepository,
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
	) {}

	/**
	 * 서버 시작 시 계정 정리 catch-up
	 *
	 * grace period 기반이므로 멱등성 보장.
	 * 서버 다운 중 놓친 정리 작업을 즉시 실행합니다.
	 */
	async onModuleInit(): Promise<void> {
		try {
			this.#logger.log("Running account purge catch-up on startup...");
			await this.purgeDeletedAccounts();
		} catch (error) {
			this.#logger.error(
				`Account purge catch-up failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	@Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: "Asia/Seoul" })
	async purgeDeletedAccounts(): Promise<void> {
		const release = await this.lockProvider.acquire(
			PURGE_LOCK_KEY,
			PURGE_LOCK_TTL_MS,
		);

		if (!release) {
			this.#logger.debug(
				"Account purge already running on another instance, skipping",
			);
			return;
		}

		try {
			await this.#executePurge();
		} finally {
			await release();
		}
	}

	async #executePurge(): Promise<void> {
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
