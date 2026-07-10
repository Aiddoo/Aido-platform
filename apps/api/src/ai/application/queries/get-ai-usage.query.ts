import { Query } from "@nestjs/cqrs";
import type { AiUsage } from "../../domain/value-objects/ai-usage.vo";

/**
 * 현재 사용자의 월간 AI 사용량 조회 쿼리.
 */
export class GetAiUsageQuery extends Query<AiUsage> {
	constructor(public readonly userId: string) {
		super();
	}
}
