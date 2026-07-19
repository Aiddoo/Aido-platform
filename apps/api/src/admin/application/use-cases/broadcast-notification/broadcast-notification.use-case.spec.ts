/**
 * BroadcastNotificationUseCase 단위 테스트
 *
 * 실제 DB/발송 없이 포트를 스텁으로 대체해 배치 스트리밍·집계·예외만 검증한다.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import {
	ADMIN_BROADCAST_NOTIFIER,
	type AdminBroadcastNotifierPort,
} from "../../ports/admin-broadcast-notifier.port";
import {
	ADMIN_USER_DIRECTORY,
	type AdminUserDirectoryPort,
} from "../../ports/admin-user-directory.port";
import { BroadcastNotificationUseCase } from "./broadcast-notification.use-case";

/** 주어진 배치들을 순서대로 흘려보내는 async 이터러블 스텁 */
async function* streamOf(batches: string[][]): AsyncIterable<string[]> {
	for (const batch of batches) {
		yield batch;
	}
}

describe("BroadcastNotificationUseCase — 브로드캐스트", () => {
	let useCase: BroadcastNotificationUseCase;
	let userDirectory: Mocked<AdminUserDirectoryPort>;
	let notifier: Mocked<AdminBroadcastNotifierPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			BroadcastNotificationUseCase,
		).compile();

		useCase = unit;
		userDirectory = unitRef.get(ADMIN_USER_DIRECTORY);
		notifier = unitRef.get(ADMIN_BROADCAST_NOTIFIER);
	});

	it("여러 배치를 스트리밍하며 배치마다 발송하고 결과를 집계한다", async () => {
		// Given - 2개 배치(3+2명)가 스트리밍되고 각각 발송이 성공할 때
		userDirectory.streamTargetUserIds.mockReturnValue(
			streamOf([
				["u1", "u2", "u3"],
				["u4", "u5"],
			]),
		);
		notifier.sendBatch
			.mockResolvedValueOnce({ count: 3 })
			.mockResolvedValueOnce({ count: 2 });

		// When - 브로드캐스트를 실행하면
		const result = await useCase.execute({
			title: "제목",
			body: "내용",
			targetFilter: "ALL",
			action: undefined,
			force: false,
		});

		// Then - 배치별로 발송하고 총계를 반환한다
		expect(notifier.sendBatch).toHaveBeenCalledTimes(2);
		expect(result).toEqual({
			successCount: 5,
			failCount: 0,
			totalTargets: 5,
		});
	});

	it("외부 URL 액션이 있으면 externalUrl 메타데이터를 부여한다", async () => {
		// Given - 브라우저 액션(url 포함)이 주어졌을 때
		userDirectory.streamTargetUserIds.mockReturnValue(streamOf([["u1"]]));
		notifier.sendBatch.mockResolvedValue({ count: 1 });

		// When - 브로드캐스트를 실행하면
		await useCase.execute({
			title: "제목",
			body: "내용",
			targetFilter: "ALL",
			action: {
				type: "BROWSER",
				url: "https://aido.kr/event",
			},
			force: false,
		});

		// Then - 발송 메시지에 externalUrl 메타데이터가 포함된다
		const messages = notifier.sendBatch.mock.calls[0]?.[0];
		expect(messages?.[0]).toMatchObject({
			type: "ADMIN_BROADCAST",
			metadata: { externalUrl: "https://aido.kr/event" },
		});
	});

	it("force 입력은 발송 메시지에 그대로 전파된다", async () => {
		// Given - force 브로드캐스트 요청
		userDirectory.streamTargetUserIds.mockReturnValue(streamOf([["u1"]]));
		notifier.sendBatch.mockResolvedValue({ count: 1 });

		// When - force로 브로드캐스트를 실행하면
		await useCase.execute({
			title: "제목",
			body: "내용",
			targetFilter: "WITH_PUSH_TOKEN",
			action: undefined,
			force: true,
		});

		// Then - 모든 발송 메시지에 force가 포함된다
		const messages = notifier.sendBatch.mock.calls[0]?.[0];
		expect(messages?.[0]).toMatchObject({ force: true });
	});

	it("대상이 한 명도 없으면 ADMIN_1402를 던진다", async () => {
		// Given - 대상 스트림이 비어 있을 때
		userDirectory.streamTargetUserIds.mockReturnValue(streamOf([]));

		// When/Then - 대상 없음 예외로 실패한다
		await expect(
			useCase.execute({
				title: "제목",
				body: "내용",
				targetFilter: "ALL",
				action: undefined,
				force: false,
			}),
		).rejects.toMatchObject({ errorCode: "ADMIN_1402" });
		expect(notifier.sendBatch).not.toHaveBeenCalled();
	});
});
