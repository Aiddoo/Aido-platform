import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createRetentionRepositoryMock } from "@test/mocks/ports";
import {
	RETENTION_REPOSITORY,
	type RetentionDispatchCandidate,
	type RetentionRepositoryPort,
} from "../../ports/retention.repository.port";
import {
	RETENTION_CONFIG,
	type RetentionConfigPort,
} from "../../ports/retention-config.port";
import {
	RETENTION_PUSH_SENDER,
	type RetentionPushSenderPort,
} from "../../ports/retention-push-sender.port";
import { DispatchRetentionPushUseCase } from "./dispatch-retention-push.use-case";

describe("DispatchRetentionPushUseCase — 멱등 푸시 처리", () => {
	let useCase: DispatchRetentionPushUseCase;
	let repository: Mocked<RetentionRepositoryPort>;
	let sender: Mocked<RetentionPushSenderPort>;

	beforeEach(async () => {
		const compiled = await TestBed.solitary(DispatchRetentionPushUseCase)
			.mock<RetentionRepositoryPort>(RETENTION_REPOSITORY)
			.impl(() => createRetentionRepositoryMock())
			.mock<RetentionPushSenderPort>(RETENTION_PUSH_SENDER)
			.impl(() => ({ canSend: jest.fn(), send: jest.fn() }))
			.mock<RetentionConfigPort>(RETENTION_CONFIG)
			.impl(() => ({ enabled: true, treatmentPercent: 50 }))
			.compile();
		useCase = compiled.unit;
		repository = compiled.unitRef.get(RETENTION_REPOSITORY);
		sender = compiled.unitRef.get(RETENTION_PUSH_SENDER);
	});

	function candidate(): RetentionDispatchCandidate {
		return {
			outboxId: "outbox-1",
			dispatchId: 1,
			notificationId: 2,
			userId: "new-user",
			title: "title",
			body: "body",
			actionUrl: "/feed",
			campaignKey: "onboarding_v2_d7",
			variantId: "d1_no_todo",
			timezone: "Asia/Seoul",
			pushEnabled: true,
			nightPushEnabled: false,
			marketingPushAgreedAt: new Date(),
			tokens: [{ id: 1, token: "fake-token" }],
		};
	}

	it("이미 다른 worker가 claim한 중복 job은 전송하지 않는다", async () => {
		repository.claimDispatch.mockResolvedValue(null);

		await useCase.execute("outbox-1");

		expect(sender.send).not.toHaveBeenCalled();
	});

	it("kill switch가 꺼지면 outbox를 보류해 재활성화 후 다시 처리할 수 있다", async () => {
		const compiled = await TestBed.solitary(DispatchRetentionPushUseCase)
			.mock<RetentionRepositoryPort>(RETENTION_REPOSITORY)
			.impl(() => createRetentionRepositoryMock())
			.mock<RetentionPushSenderPort>(RETENTION_PUSH_SENDER)
			.impl(() => ({ canSend: jest.fn(), send: jest.fn() }))
			.mock<RetentionConfigPort>(RETENTION_CONFIG)
			.impl(() => ({ enabled: false, treatmentPercent: 50 }))
			.compile();
		const disabledRepository =
			compiled.unitRef.get<RetentionRepositoryPort>(RETENTION_REPOSITORY);

		await compiled.unit.execute("outbox-1");

		expect(disabledRepository.deferOutbox).toHaveBeenCalledWith(
			"outbox-1",
			expect.any(Date),
		);
	});

	it("전송 성공 결과를 dispatch attempt 저장 포트에 전달한다", async () => {
		const claimed = candidate();
		const results = [
			{ token: "fake-token", success: true, ticketId: "ticket" },
		];
		repository.claimDispatch.mockResolvedValue(claimed);
		sender.canSend.mockResolvedValue(true);
		sender.send.mockResolvedValue(results);

		await useCase.execute("outbox-1");

		expect(repository.recordDeliveryResults).toHaveBeenCalledWith(1, results);
	});

	it("provider 오류 시 dispatch를 PENDING으로 되돌리고 BullMQ 재시도에 위임한다", async () => {
		repository.claimDispatch.mockResolvedValue(candidate());
		sender.canSend.mockResolvedValue(true);
		sender.send.mockRejectedValue(new Error("expo down"));

		await expect(useCase.execute("outbox-1")).rejects.toThrow("expo down");
		expect(repository.releaseDispatch).toHaveBeenCalledWith(1, "expo down");
	});
});
