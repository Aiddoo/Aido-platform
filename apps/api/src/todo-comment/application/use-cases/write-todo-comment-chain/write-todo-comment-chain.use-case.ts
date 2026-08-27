import { ErrorCode } from "@aido/errors";
import type { TodoCommentChainResponse } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	MUTATION_LOCK,
	MutationLockKeys,
	type MutationLockPort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "@/shared/application/ports";
import { ApplicationException } from "@/shared/domain";

import { ThreadPlacement } from "../../../domain/value-objects/thread-placement.vo";
import { TodoCommentContent } from "../../../domain/value-objects/todo-comment-content.vo";
import { assertTodoCommentAccess } from "../../assert-todo-comment-access";
import {
	TODO_COMMENT_NOTIFICATION,
	type TodoCommentNotificationPort,
} from "../../ports/todo-comment-notification.port";
import {
	TODO_COMMENT_READER,
	type TodoCommentReaderPort,
} from "../../ports/todo-comment.reader.port";
import {
	TODO_COMMENT_REPOSITORY,
	TodoCommentIdempotencyConflict,
	TodoCommentIdempotencyRace,
	type TodoCommentRepositoryPort,
} from "../../ports/todo-comment.repository.port";
import { TODO_VIEW_CACHE, type TodoViewCachePort } from "../../ports/todo-view-cache.port";
import { toTodoCommentResponse } from "../../presenters";
import { settleAfterCommit } from "../../settle-after-commit";
import type { TodoCommentChainCommand, TodoCommentRecord } from "../../types";

export interface WriteTodoCommentChainInput {
	todoId: number;
	authorId: string;
	parentId: string | null;
	items: { clientRequestId: string; content: string }[];
}

interface WriteOutcome {
	written: TodoCommentRecord[];
	likedCommentIds: ReadonlySet<string>;
	addedCount: number;
	recipientId: string;
	threadRootId: string;
}

function normalizeCommand(input: WriteTodoCommentChainInput): TodoCommentChainCommand {
	if (input.items.length === 0) {
		throw new ApplicationException(ErrorCode.SYS_0002);
	}

	return {
		todoId: input.todoId,
		authorId: input.authorId,
		parentId: input.parentId,
		items: input.items.map((item) => ({
			clientRequestId: item.clientRequestId,
			content: TodoCommentContent.create(item.content).getValue(),
		})),
	};
}

function requireFirst(records: readonly TodoCommentRecord[]): TodoCommentRecord {
	const first = records[0];
	if (first === undefined) {
		throw new ApplicationException(ErrorCode.SYS_0003);
	}

	return first;
}

function throwMappedWriteError(error: unknown): never {
	if (error instanceof TodoCommentIdempotencyConflict) {
		throw new ApplicationException(ErrorCode.SYS_0002);
	}

	throw error;
}

@Injectable()
export class WriteTodoCommentChainUseCase {
	readonly #logger = new Logger(WriteTodoCommentChainUseCase.name);

	constructor(
		@Inject(TODO_COMMENT_READER)
		private readonly reader: TodoCommentReaderPort,
		@Inject(TODO_COMMENT_REPOSITORY)
		private readonly repository: TodoCommentRepositoryPort,
		@Inject(TODO_COMMENT_NOTIFICATION)
		private readonly notification: TodoCommentNotificationPort,
		@Inject(TODO_VIEW_CACHE)
		private readonly todoViewCache: TodoViewCachePort,
		@Inject(MUTATION_LOCK)
		private readonly mutationLock: MutationLockPort,
		@Inject(UNIT_OF_WORK)
		private readonly unitOfWork: UnitOfWorkPort,
	) {}

	async execute(input: WriteTodoCommentChainInput): Promise<TodoCommentChainResponse> {
		const command = normalizeCommand(input);
		const outcome = await this.resolveWrite(command);

		if (outcome.addedCount > 0) {
			const first = requireFirst(outcome.written);
			await settleAfterCommit(this.#logger, [
				{
					label: "할 일 화면 캐시 무효화",
					run: () => this.todoViewCache.invalidateForTodo(input.todoId),
				},
				{
					label: "댓글 작성 알림",
					run: () =>
						this.notification.notifyCommentsWritten({
							recipientId: outcome.recipientId,
							senderId: input.authorId,
							senderName: first.authorName,
							todoId: input.todoId,
							commentId: first.id,
							threadRootId: outcome.threadRootId,
							isReply: input.parentId !== null,
							count: outcome.addedCount,
						}),
				},
			]);
		}

		return {
			comments: outcome.written.map((record) =>
				toTodoCommentResponse(record, input.authorId, outcome.likedCommentIds),
			),
		};
	}

	private async resolveWrite(command: TodoCommentChainCommand): Promise<WriteOutcome> {
		try {
			return await this.write(command);
		} catch (error) {
			if (!(error instanceof TodoCommentIdempotencyRace)) {
				throwMappedWriteError(error);
			}

			try {
				return await this.replayAfterRace(command);
			} catch (replayError) {
				throwMappedWriteError(replayError);
			}
		}
	}

	private write(command: TodoCommentChainCommand): Promise<WriteOutcome> {
		return this.unitOfWork.run(async () => {
			const lockKeys = command.items.map((item) =>
				MutationLockKeys.todoCommentRequest(command.authorId, item.clientRequestId),
			);
			if (command.parentId !== null) {
				lockKeys.push(MutationLockKeys.todoComment(command.parentId));
			}

			await this.mutationLock.acquire(lockKeys);
			await assertTodoCommentAccess(this.reader, command.todoId, command.authorId);
			const replayIds = await this.repository.findCommentChainReplay(command);
			if (replayIds !== null) {
				return this.loadReplay(command, replayIds);
			}

			const parent =
				command.parentId === null
					? null
					: await this.repository.findComment(command.todoId, command.parentId);
			if (command.parentId !== null && parent === null) {
				throw new ApplicationException(ErrorCode.TODO_0831, { commentId: command.parentId });
			}

			const chain = await this.repository.createCommentChain({
				todoId: command.todoId,
				authorId: command.authorId,
				placement: parent === null ? ThreadPlacement.topLevel() : parent.placeReply(),
				items: command.items,
			});
			await this.repository.increaseTodoCommentCount(command.todoId, chain.createdCount);

			if (parent !== null && !(await this.repository.incrementReplyCount(parent.id.getValue()))) {
				throw new ApplicationException(ErrorCode.SYS_0003, {
					commentId: parent.id.getValue(),
				});
			}

			const written = await this.reader.findCommentRecords(command.todoId, chain.commentIds);
			const first = requireFirst(written);
			if (written.length !== chain.commentIds.length) {
				throw new ApplicationException(ErrorCode.SYS_0003);
			}

			return {
				written,
				likedCommentIds: new Set<string>(),
				addedCount: chain.createdCount,
				recipientId: parent === null ? first.todoOwnerId : parent.authorId,
				threadRootId: parent === null ? first.id : parent.threadRootId.getValue(),
			};
		});
	}

	/** P2002가 난 트랜잭션은 폐기하고 새 UoW에서 승자의 행을 읽는다. */
	private replayAfterRace(command: TodoCommentChainCommand): Promise<WriteOutcome> {
		return this.unitOfWork.run(async () => {
			const replayIds = await this.repository.findCommentChainReplay(command);
			if (replayIds === null) {
				throw new ApplicationException(ErrorCode.SYS_0003);
			}

			return this.loadReplay(command, replayIds);
		});
	}

	private async loadReplay(
		command: TodoCommentChainCommand,
		commentIds: readonly string[],
	): Promise<WriteOutcome> {
		const written = await this.reader.findCommentRecords(command.todoId, commentIds);
		const first = requireFirst(written);
		if (written.length !== commentIds.length) {
			throw new TodoCommentIdempotencyConflict();
		}

		const likedCommentIds = await this.reader.findLikedCommentIds(commentIds, command.authorId);
		return {
			written,
			likedCommentIds,
			addedCount: 0,
			recipientId: first.todoOwnerId,
			threadRootId: first.rootId ?? first.id,
		};
	}
}
