import type { UserRole } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import { SECURITY_EVENT } from "@/auth/domain/constants/auth.constants";
import type { TokenPair } from "@/auth/infrastructure/adapters/token.service";
import { LoginAttemptRepository } from "@/auth/infrastructure/persistence/login-attempt.repository";
import { SecurityLogRepository } from "@/auth/infrastructure/persistence/security-log.repository";
import { UserRepository } from "@/auth/infrastructure/persistence/user.repository";
import type { AccountProvider } from "@/generated/prisma/client";
import type { TransactionClient } from "@/shared/infrastructure/database/prisma.types";
import { SessionService } from "../../services/session.service";

export interface IssueLoginInput {
	userId: string;
	email: string;
	role: UserRole;
	provider: AccountProvider;
	ip: string;
	userAgent: string;
	deviceFingerprint: string;
	/** 소셜 로그인은 { provider } 메타데이터를 보안 로그에 남긴다(크레덴셜은 생략) */
	securityMetadata?: Record<string, unknown>;
}

export interface IssueLoginOutcome {
	sessionId: string;
	tokens: TokenPair;
	userTag: string;
	name: string | null;
	profileImage: string | null;
}

/**
 * 로그인 성공 발급 공통 시퀀스 — 이메일 로그인과 소셜 로그인의 수렴점.
 *
 * (1) 세션 생성 + JWT 토큰 발급 → (2) 로그인 성공 기록 →
 * (3) LOGIN_SUCCESS 보안 로그 → (4) 프로필 조회.
 * 호출측이 연 트랜잭션(tx)에 참여하며, 탈퇴 복구·캐시 무효화·accountRestored
 * 플래그 등 provider별 처리는 호출측이 담당한다.
 */
@Injectable()
export class IssueLoginUseCase {
	constructor(
		private readonly sessionService: SessionService,
		private readonly loginAttemptRepository: LoginAttemptRepository,
		private readonly securityLogRepository: SecurityLogRepository,
		private readonly userRepository: UserRepository,
	) {}

	async execute(
		input: IssueLoginInput,
		tx: TransactionClient,
	): Promise<IssueLoginOutcome> {
		const { sessionId, tokens } =
			await this.sessionService.createSessionWithTokens(
				{
					userId: input.userId,
					email: input.email,
					role: input.role,
					deviceFingerprint: input.deviceFingerprint,
					userAgent: input.userAgent,
					ipAddress: input.ip,
				},
				tx,
			);

		await this.loginAttemptRepository.create(
			{
				email: input.email,
				provider: input.provider,
				ipAddress: input.ip,
				userAgent: input.userAgent,
				success: true,
			},
			tx,
		);

		await this.securityLogRepository.create(
			{
				userId: input.userId,
				event: SECURITY_EVENT.LOGIN_SUCCESS,
				ipAddress: input.ip,
				userAgent: input.userAgent,
				...(input.securityMetadata ? { metadata: input.securityMetadata } : {}),
			},
			tx,
		);

		const userWithProfile = await this.userRepository.findByIdWithProfile(
			input.userId,
			tx,
		);

		return {
			sessionId,
			tokens,
			userTag: userWithProfile?.userTag ?? "",
			name: userWithProfile?.profile?.name ?? null,
			profileImage: userWithProfile?.profile?.profileImage ?? null,
		};
	}
}
