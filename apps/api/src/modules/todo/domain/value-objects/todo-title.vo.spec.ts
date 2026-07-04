/**
 * TodoTitle VO 단위 테스트
 *
 * GWT 패턴 — 제목 길이 불변식 검증
 */

import { ErrorCode } from "@aido/errors";
import { DomainException } from "@/common/domain";
import { TodoTitle } from "./todo-title.vo";

describe("TodoTitle — 제목 값 객체", () => {
	it("1자 제목이면 생성된다 (하한 경계값)", () => {
		// Given & When
		const title = TodoTitle.create("가");

		// Then
		expect(title.getValue()).toBe("가");
	});

	it("200자 제목이면 생성된다 (상한 경계값)", () => {
		// Given & When
		const title = TodoTitle.create("가".repeat(200));

		// Then
		expect(title.getValue()).toHaveLength(200);
	});

	it("빈 문자열이면 DomainException(SYS_0002)을 던진다", () => {
		// Given
		const create = () => TodoTitle.create("");

		// When & Then
		expect(create).toThrow(DomainException);
		expect(create).toThrow("제목은 1~200자여야 합니다.");
		try {
			create();
		} catch (error) {
			if (error instanceof DomainException) {
				expect(error.errorCode).toBe(ErrorCode.SYS_0002);
			}
		}
	});

	it("201자 제목이면 DomainException(SYS_0002)을 던진다", () => {
		// Given
		const create = () => TodoTitle.create("가".repeat(201));

		// When & Then
		expect(create).toThrow(DomainException);
		try {
			create();
		} catch (error) {
			if (error instanceof DomainException) {
				expect(error.errorCode).toBe(ErrorCode.SYS_0002);
			}
		}
	});
});
