import type { Memo as MemoResponse } from "@aido/validators";
import { Command } from "@nestjs/cqrs";

/** 메모 변경 계열 유스케이스의 공통 결과(메시지 + 메모 뷰). */
export interface MemoMutationResult {
	message: string;
	memo: MemoResponse;
}

/** 메모 생성 커맨드. 사용자당 한도 확인 후 정렬 최상단에 생성한다. */
export class CreateMemoCommand extends Command<MemoMutationResult> {
	constructor(
		public readonly userId: string,
		public readonly content: string,
	) {
		super();
	}
}
