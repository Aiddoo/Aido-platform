import type { UserRole } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";
import { SECURITY_EVENT } from "@/auth/domain/constants/auth.constants";
import type { AccountProvider } from "@/auth/domain/types";
import type { TokenPair } from "../../ports/auth-crypto.port";
import {
	AUTH_LOGIN_ATTEMPT_REPOSITORY,
	AUTH_SECURITY_LOG_REPOSITORY,
	AUTH_USER_REPOSITORY,
	type AuthLoginAttemptRepositoryPort,
	type AuthSecurityLogRepositoryPort,
	type AuthUserRepositoryPort,
} from "../../ports/auth-persistence.port";
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
 * 호출측이 연 트랜잭션(CLS)에 참여하며, 탈퇴 복구·캐시 무효화·accountRestored
 * 플래그 등 provider별 처리는 호출측이 담당한다.
 */
@Injectable()
export class IssueLoginUseCase {
	constructor(
		private readonly sessionService: SessionService,
		@Inject(AUTH_LOGIN_ATTEMPT_REPOSITORY)
		private readonly loginAttemptRepository: AuthLoginAttemptRepositoryPort,
		@Inject(AUTH_SECURITY_LOG_REPOSITORY)
		private readonly securityLogRepository: AuthSecurityLogRepositoryPort,
		@Inject(AUTH_USER_REPOSITORY)
		private readonly userRepository: AuthUserRepositoryPort,
	) {}

	async execute(input: IssueLoginInput): Promise<IssueLoginOutcome> {
		const { sessionId, tokens } =
			await this.sessionService.createSessionWithTokens({
				userId: input.userId,
				email: input.email,
				role: input.role,
				deviceFingerprint: input.deviceFingerprint,
				userAgent: input.userAgent,
				ipAddress: input.ip,
			});

		await this.loginAttemptRepository.create({
			email: input.email,
			provider: input.provider,
			ipAddress: input.ip,
			userAgent: input.userAgent,
			success: true,
		});

		await this.securityLogRepository.create({
			userId: input.userId,
			event: SECURITY_EVENT.LOGIN_SUCCESS,
			ipAddress: input.ip,
			userAgent: input.userAgent,
			...(input.securityMetadata ? { metadata: input.securityMetadata } : {}),
		});

		const userWithProfile = await this.userRepository.findByIdWithProfile(
			input.userId,
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
