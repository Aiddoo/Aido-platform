import { ErrorCode } from "@aido/errors";
import { ExecutionContext, HttpException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "@/auth/presentation/decorators/public.decorator";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { ErrorCodedException } from "@/shared/domain/exceptions/error-coded.exception";

/**
 * JWT Access Token 인증 가드
 *
 * @Public() 데코레이터가 적용된 라우트는 인증을 건너뜀
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
	constructor(private readonly reflector: Reflector) {
		super();
	}

	override canActivate(context: ExecutionContext) {
		// @Public() 데코레이터가 있으면 인증 건너뛰기
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		return super.canActivate(context);
	}

	override handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
		if (
			err &&
			!(err instanceof HttpException) &&
			!(err instanceof ErrorCodedException)
		) {
			// 인프라 오류(DB/캐시 장애 등)는 401로 위장하지 않는다.
			// 401은 클라이언트가 토큰 삭제(강제 로그아웃)로 반응하므로,
			// GlobalExceptionFilter가 500으로 처리 + Sentry 리포트되도록 rethrow.
			// 의도적 인증 예외(ErrorCodedException=ApplicationException/DomainException)는
			// 레거시 BusinessException(HttpException)과 동일하게 AUTH_0101로 재래핑한다.
			throw err;
		}

		if (err || !user) {
			throw new ApplicationException(ErrorCode.AUTH_0101, {
				reason: err?.message || "Access token is missing or invalid",
			});
		}
		return user;
	}
}
