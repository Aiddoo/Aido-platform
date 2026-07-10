/**
 * CreateInquiryHandler 단위 테스트
 *
 * 실제 이메일을 보내지 않는다 — InquiryMailerPort를 스텁으로 대체해
 * 전달 성공/실패에 따른 핸들러 동작만 검증한다 (SOLID/DIP).
 */
import type { InquiryCategory } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import {
	INQUIRY_MAILER,
	type InquiryMailerPort,
} from "../../ports/inquiry-mailer.port";
import { CreateInquiryCommand } from "./create-inquiry.command";
import { CreateInquiryHandler } from "./create-inquiry.handler";

function makeCommand(
	overrides: Partial<{
		userId: string;
		userEmail: string;
		category: InquiryCategory;
		content: string;
	}> = {},
): CreateInquiryCommand {
	return new CreateInquiryCommand(
		overrides.userId ?? "user-123",
		overrides.userEmail ?? "user@example.com",
		overrides.category ?? "BUG_REPORT",
		overrides.content ?? "앱이 갑자기 종료됩니다.",
	);
}

describe("CreateInquiryHandler — 문의 접수 핸들러", () => {
	let handler: CreateInquiryHandler;
	let mailer: Mocked<InquiryMailerPort>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(CreateInquiryHandler).compile();

		handler = unit;
		mailer = unitRef.get(INQUIRY_MAILER);
	});

	it("전달이 성공하면 벤더 중립 제출 값으로 메일러를 호출한다", async () => {
		// Given - 메일러가 성공을 반환하도록 스텁되었을 때
		mailer.deliver.mockResolvedValue({ success: true });

		// When - 문의 접수를 실행하면
		await handler.execute(makeCommand({ category: "BUG_REPORT" }));

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
		await expect(handler.execute(makeCommand())).rejects.toMatchObject({
			errorCode: "INQUIRY_1501",
		});
	});
});
