import { Command } from "@nestjs/cqrs";
import type { MemoMutationResult } from "../create-memo/create-memo.command";

/** 메모 고정/해제 커맨드. */
export class ToggleMemoPinCommand extends Command<MemoMutationResult> {
	constructor(
		public readonly userId: string,
		public readonly memoId: number,
		public readonly isPinned: boolean,
	) {
		super();
	}
}
