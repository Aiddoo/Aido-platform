import { ErrorCode } from "@aido/errors";
import { Injectable } from "@nestjs/common";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

/**
 * 리포트 접근 정책
 *
 * 리포트 조회는 프리미엄(구독 ACTIVE 또는 ADMIN)만 가능하다.
 */
@Injectable()
export class ReportAccessService {
	constructor(private readonly entitlementService: EntitlementService) {}

	async enforcePremium(userId: string): Promise<void> {
		const hasPremium = await this.entitlementService.hasPremiumAccess(userId);
		if (!hasPremium) {
			throw new ApplicationException(ErrorCode.AI_1308);
		}
	}
}
