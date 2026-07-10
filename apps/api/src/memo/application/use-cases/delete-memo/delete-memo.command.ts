import { Command } from "@nestjs/cqrs";

/** 메모 삭제 결과. */
export interface DeleteMemoResult {
	message: string;
}

/** 메모 삭제 커맨드 (소유권 확인 후 영구 삭제). */
export class DeleteMemoCommand extends Command<DeleteMemoResult> {
	constructor(
		public readonly userId: string,
		public readonly memoId: number,
	) {
		super();
	}
}
