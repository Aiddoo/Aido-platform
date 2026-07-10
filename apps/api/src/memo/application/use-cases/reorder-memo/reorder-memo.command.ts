import { Command } from "@nestjs/cqrs";
import type { MemoMutationResult } from "../create-memo/create-memo.command";

/**
 * 메모 순서 변경 커맨드.
 * targetMemoId 생략 시 맨 앞/뒤로 이동한다.
 */
export class ReorderMemoCommand extends Command<MemoMutationResult> {
	constructor(
		public readonly userId: string,
		public readonly memoId: number,
		public readonly position: "before" | "after",
		public readonly targetMemoId?: number,
	) {
		super();
	}
}
