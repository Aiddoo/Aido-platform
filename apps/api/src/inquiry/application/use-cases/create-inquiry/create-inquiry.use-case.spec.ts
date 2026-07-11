import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import {
	INQUIRY_MAILER,
	type InquiryMailerPort,
} from "../../ports/inquiry-mailer.port";
import {
	type CreateInquiryInput,
	CreateInquiryUseCase,
} from "./create-inquiry.use-case";

function makeInput(
	overrides: Partial<CreateInquiryInput> = {},
): CreateInquiryInput {
	return {
		userId: overrides.userId ?? "user-123",
		userEmail: overrides.userEmail ?? "user@example.com",
		category: overrides.category ?? "BUG_REPORT",
		content: overrides.content ?? "앱이 갑자기 종료됩니다.",
	};
}

describe("CreateInquiryUseCase — 문의 접수", () => {
	let useCase: CreateInquiryUseCase;
	let mailer: Mocked<InquiryMailerPort>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(CreateInquiryUseCase).compile();

		useCase = unit;
		mailer = unitRef.get(INQUIRY_MAILER);
	});

	it("전달이 성공하면 벤더 중립 제출 값으로 메일러를 호출한다", async () => {
		// Given - 메일러가 성공을 반환하도록 스텁되었을 때
		mailer.deliver.mockResolvedValue({ success: true });

		// When - 문의 접수를 실행하면
		await useCase.execute(makeInput({ category: "BUG_REPORT" }));

		// Then - 라벨/타임스탬프가 조립된 제출 값으로 메일러가 호출된다
		expect(mailer.deliver).toHaveBeenCalledTimes(1);
		const submission = mailer.deliver.mock.calls[0]?.[0];
		expect(submission).toMatchObject({
			userEmail: "user@example.com",
			category: "BUG_REPORT",
			categoryLabel: "버그 신고",
			content: "앱이 갑자기 종료됩니다.",
		});
		expect(submission?.submittedAt).toMatch(/\(KST\)$/);
	});

	it("전달이 실패하면 INQUIRY_1501을 던진다", async () => {
		// Given - 메일러가 실패를 반환하도록 스텁되었을 때
		mailer.deliver.mockResolvedValue({ success: false, error: "smtp down" });

		// When/Then - 문의 접수가 비즈니스 예외로 실패해야 한다
		await expect(useCase.execute(makeInput())).rejects.toMatchObject({
			errorCode: "INQUIRY_1501",
		});
	});
});
