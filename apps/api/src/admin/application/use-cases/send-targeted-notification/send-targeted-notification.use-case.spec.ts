/**
 * SendTargetedNotificationUseCase 단위 테스트
 *
 * 실제 DB/발송 없이 포트를 스텁으로 대체해 존재 사용자 필터·발송·예외를 검증한다.
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
import { SendTargetedNotificationUseCase } from "./send-targeted-notification.use-case";

describe("SendTargetedNotificationUseCase — 타겟 발송", () => {
	let useCase: SendTargetedNotificationUseCase;
	let userDirectory: Mocked<AdminUserDirectoryPort>;
	let notifier: Mocked<AdminBroadcastNotifierPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(SendTargetedNotificationUseCase).compile();

		useCase = unit;
		userDirectory = unitRef.get(ADMIN_USER_DIRECTORY);
		notifier = unitRef.get(ADMIN_BROADCAST_NOTIFIER);
	});

	it("존재하는 사용자만 필터링해 발송하고 총 대상은 존재 수로 집계한다", async () => {
		// Given - 3명 중 2명만 존재하고 발송이 성공할 때
		userDirectory.findExistingUserIds.mockResolvedValue(["u1", "u2"]);
		notifier.sendBatch.mockResolvedValue({ count: 2 });

		// When - 타겟 발송을 실행하면
		const result = await useCase.execute({
			title: "제목",
			body: "내용",
			userIds: ["u1", "u2", "u3"],
			action: undefined,
			force: false,
		});

		// Then - 존재 사용자 수 기준으로 집계된다
		const messages = notifier.sendBatch.mock.calls[0]?.[0];
		expect(messages).toHaveLength(2);
		expect(messages?.[0]?.type).toBe("ADMIN_TARGETED");
		expect(result).toEqual({
			successCount: 2,
			failCount: 0,
			totalTargets: 2,
		});
	});

	it("force 입력은 발송 메시지에 그대로 전파된다", async () => {
		// Given - force 타겟 발송 요청
		userDirectory.findExistingUserIds.mockResolvedValue(["u1"]);
		notifier.sendBatch.mockResolvedValue({ count: 1 });

		// When - force로 타겟 발송을 실행하면
		await useCase.execute({
			title: "제목",
			body: "내용",
			userIds: ["u1"],
			action: undefined,
			force: true,
		});

		// Then - 발송 메시지에 force가 포함된다
		const messages = notifier.sendBatch.mock.calls[0]?.[0];
		expect(messages?.[0]).toMatchObject({ force: true });
	});

	it("존재하는 사용자가 없으면 ADMIN_1402를 던진다", async () => {
		// Given - 존재하는 사용자가 하나도 없을 때
		userDirectory.findExistingUserIds.mockResolvedValue([]);

		// When/Then - 대상 없음 예외로 실패한다
		await expect(
			useCase.execute({
				title: "제목",
				body: "내용",
				userIds: ["u1"],
				action: undefined,
				force: false,
			}),
		).rejects.toMatchObject({ errorCode: "ADMIN_1402" });
		expect(notifier.sendBatch).not.toHaveBeenCalled();
	});
});
