import { Injectable } from "@nestjs/common";

import { subtractDays } from "@/common/date/utils";
import { DatabaseService } from "@/database";
import type {
	AccountProvider,
	LoginAttempt,
	Prisma,
} from "@/generated/prisma/client";

@Injectable()
export class LoginAttemptRepository {
	constructor(private readonly database: DatabaseService) {}

	/**
	 * 로그인 시도 기록
	 *
	 * @param data.provider - 인증 방식 (CREDENTIAL, KAKAO, APPLE, GOOGLE, NAVER)
	 *                        null인 경우 레거시 데이터 (마이그레이션 이전)
	 */
	/**
	 * 로그인 시도 기록 생성
	 *
	 * Rate limiting 및 보안 분석을 위해 모든 로그인 시도를 기록합니다.
	 *
	 * @param data.email - 로그인 시도한 이메일
	 * @param data.provider - 인증 방식 (CREDENTIAL, KAKAO, APPLE, GOOGLE, NAVER)
	 *                        OAuth 로그인의 경우 해당 provider, 이메일 로그인은 CREDENTIAL
	 * @param data.ipAddress - 클라이언트 IP 주소
	 * @param data.userAgent - 클라이언트 User-Agent
	 * @param data.success - 로그인 성공 여부
	 * @param data.failureReason - 실패 사유 (실패 시)
	 * @param tx - 트랜잭션 클라이언트 (선택)
	 * @returns 생성된 LoginAttempt 레코드
	 */
	async create(
		data: {
			email: string;
			provider?: AccountProvider;
			ipAddress: string;
			userAgent: string;
			success: boolean;
			failureReason?: string;
		},
		tx?: Prisma.TransactionClient,
	): Promise<LoginAttempt> {
		const client = tx ?? this.database;
		return client.loginAttempt.create({
			data: {
				email: data.email,
				provider: data.provider,
				ipAddress: data.ipAddress,
				userAgent: data.userAgent,
				success: data.success,
				failureReason: data.failureReason,
			},
		});
	}

	/**
	 * 특정 이메일의 최근 실패 횟수 조회
	 */
	async countRecentFailuresByEmail(
		email: string,
		since: Date,
	): Promise<number> {
		return this.database.loginAttempt.count({
			where: {
				email,
				success: false,
				createdAt: { gte: since },
			},
		});
	}

	/**
	 * 특정 IP의 최근 실패 횟수 조회
	 */
	async countRecentFailuresByIp(
		ipAddress: string,
		since: Date,
	): Promise<number> {
		return this.database.loginAttempt.count({
			where: {
				ipAddress,
				success: false,
				createdAt: { gte: since },
			},
		});
	}

	/**
	 * 이메일의 마지막 성공 시도 조회
	 */
	async findLastSuccessByEmail(email: string): Promise<LoginAttempt | null> {
		return this.database.loginAttempt.findFirst({
			where: {
				email,
				success: true,
			},
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * 이메일의 마지막 실패 시도 조회
	 */
	async findLastFailureByEmail(email: string): Promise<LoginAttempt | null> {
		return this.database.loginAttempt.findFirst({
			where: {
				email,
				success: false,
			},
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * 이메일의 특정 기간 내 실패 기록 초기화 (성공적 로그인 후)
	 *
	 * 참고: 감사 로그 목적으로 실제 삭제보다 별도 플래그 사용 고려
	 * 현재는 단순히 카운트만 사용하므로 삭제하지 않음
	 */
	async clearRecentFailuresByEmail(
		_email: string,
		_since: Date,
	): Promise<void> {
		// 감사 로그 목적으로 삭제하지 않음
		// 필요시 별도 플래그 추가 가능
	}

	/**
	 * 오래된 기록 정리 (배치 작업용, 30일 보관)
	 */
	async deleteOld(retentionDays = 30): Promise<number> {
		const cutoff = subtractDays(retentionDays);

		const result = await this.database.loginAttempt.deleteMany({
			where: {
				createdAt: { lt: cutoff },
			},
		});
		return result.count;
	}
}
