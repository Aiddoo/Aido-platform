import { Injectable } from "@nestjs/common";
import type { SupportedLocale } from "@/shared/presentation/decorators";
import type { AiUsage } from "../../domain/value-objects/ai-usage.vo";
import { GetAiUsageUseCase } from "../queries/get-ai-usage/get-ai-usage.use-case";
import {
	type ParseMemoResult,
	ParseMemoUseCase,
} from "../use-cases/parse-memo/parse-memo.use-case";
import {
	type ParseTodoResult,
	ParseTodoUseCase,
} from "../use-cases/parse-todo/parse-todo.use-case";

/**
 * AI 애플리케이션 서비스(Facade) — 컨트롤러/가드의 유일한 주입 대상.
 * 파싱 명령과 사용량 조회를 use-case 위임으로 흡수한다.
 *
 * 주의: 크로스 모듈(ai-report·ai-suggestion)은 파싱 파이프라인이 아니라
 * AI_PROVIDER 포트를 직접 주입해 사용량 미터 없이 생성만 수행한다.
 */
@Injectable()
export class AiFacade {
	constructor(
		private readonly parseTodoUseCase: ParseTodoUseCase,
		private readonly parseMemoUseCase: ParseMemoUseCase,
		private readonly getAiUsageUseCase: GetAiUsageUseCase,
	) {}

	parseTodo(
		text: string,
		userId: string,
		timezone: string,
		categoryId?: number,
		locale: SupportedLocale = "ko",
	): Promise<ParseTodoResult> {
		return this.parseTodoUseCase.execute({
			text,
			userId,
			timezone,
			categoryId,
			locale,
		});
	}

	parseMemo(
		content: string,
		userId: string,
		timezone: string,
		categoryId: number,
		locale: SupportedLocale = "ko",
	): Promise<ParseMemoResult> {
		return this.parseMemoUseCase.execute({
			content,
			userId,
			timezone,
			categoryId,
			locale,
		});
	}

	getUsage(userId: string): Promise<AiUsage> {
		return this.getAiUsageUseCase.execute({ userId });
	}
}
