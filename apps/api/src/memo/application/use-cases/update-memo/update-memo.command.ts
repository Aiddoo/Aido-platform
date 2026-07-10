import { Command } from "@nestjs/cqrs";
import type { MemoMutationResult } from "../create-memo/create-memo.command";

/** 메모 내용 수정 커맨드. */
export class UpdateMemoCommand extends Command<MemoMutationResult> {
	constructor(
		public readonly userId: string,
		public readonly memoId: number,
		public readonly content: string,
	) {
		super();
	}
}
