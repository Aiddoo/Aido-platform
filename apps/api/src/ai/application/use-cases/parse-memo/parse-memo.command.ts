import type { ParsedMemoData } from "@aido/validators";
import { Command } from "@nestjs/cqrs";
import type { SupportedLocale } from "@/shared/presentation/decorators";
import type { ParseTodoMeta } from "../parse-todo/parse-todo.command";

/** 메모 → 다중 투두 파싱 결과 (LLM 출력에 categoryId 주입). */
export interface ParseMemoResult {
	data: ParsedMemoData;
	meta: ParseTodoMeta;
}

/**
 * 메모 내용을 다중 Todo + SubTodo 데이터로 파싱하는 커맨드.
 * parse-todo와 월간 사용량을 공유하는 쓰기 유스케이스다.
 */
export class ParseMemoCommand extends Command<ParseMemoResult> {
	constructor(
		public readonly content: string,
		public readonly userId: string,
		public readonly timezone: string,
		public readonly categoryId: number,
		public readonly locale: SupportedLocale = "ko",
	) {
		super();
	}
}
