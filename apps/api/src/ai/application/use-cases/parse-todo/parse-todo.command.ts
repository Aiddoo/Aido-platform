import type { ParsedTodoData } from "@aido/validators";
import { Command } from "@nestjs/cqrs";
import type { SupportedLocale } from "@/shared/presentation/decorators";
import type { TokenUsage } from "../../ports/ai-provider.port";

/** 파싱 메타데이터 (모델·처리시간·토큰). */
export interface ParseTodoMeta {
	model: string;
	processingTimeMs: number;
	tokenUsage: TokenUsage;
}

/** 자연어 → 단건 투두 파싱 결과. */
export interface ParseTodoResult {
	data: ParsedTodoData;
	meta: ParseTodoMeta;
}

/**
 * 자연어 텍스트를 투두 데이터로 파싱하는 커맨드.
 * 사용량을 차감하는 쓰기 유스케이스다.
 */
export class ParseTodoCommand extends Command<ParseTodoResult> {
	constructor(
		public readonly text: string,
		public readonly userId: string,
		public readonly timezone: string,
		public readonly categoryId?: number,
		public readonly locale: SupportedLocale = "ko",
	) {
		super();
	}
}
