import { selectProfileTemplate } from "../profile-template-selector";

describe("selectProfileTemplate", () => {
	it("달성률 80% 이상이면 축하 + 숨은 약점 템플릿을 반환해야 한다", () => {
		// Given
		const input = { completionRate: 85, rateChange: 5 };

		// When
		const result = selectProfileTemplate(input);

		// Then
		expect(result).toContain("축하 + 숨은 약점 발굴");
	});

	it("달성률 정확히 80%면 축하 템플릿을 반환해야 한다", () => {
		// Given
		const input = { completionRate: 80, rateChange: null };

		// When
		const result = selectProfileTemplate(input);

		// Then
		expect(result).toContain("축하 + 숨은 약점 발굴");
	});

	it("달성률 50% 미만이면 공감 + 작은 성공 템플릿을 반환해야 한다", () => {
		// Given
		const input = { completionRate: 30, rateChange: -10 };

		// When
		const result = selectProfileTemplate(input);

		// Then
		expect(result).toContain("공감 + 작은 성공 스포트라이트");
	});

	it("변화율 ±15%p 이상이면 변화 원인 분석 템플릿을 반환해야 한다", () => {
		// Given
		const inputUp = { completionRate: 65, rateChange: 20 };
		const inputDown = { completionRate: 60, rateChange: -18 };

		// When
		const resultUp = selectProfileTemplate(inputUp);
		const resultDown = selectProfileTemplate(inputDown);

		// Then
		expect(resultUp).toContain("변화 원인 심층 분석");
		expect(resultDown).toContain("변화 원인 심층 분석");
	});

	it("해당 조건 없으면 심층 패턴 분석 템플릿을 반환해야 한다", () => {
		// Given
		const input = { completionRate: 65, rateChange: 5 };

		// When
		const result = selectProfileTemplate(input);

		// Then
		expect(result).toContain("심층 패턴 분석");
	});

	it("변화율이 null이면 변화 분석 템플릿을 건너뛰어야 한다", () => {
		// Given
		const input = { completionRate: 65, rateChange: null };

		// When
		const result = selectProfileTemplate(input);

		// Then
		expect(result).toContain("심층 패턴 분석");
	});

	it("달성률 50% 미만이 변화율보다 우선되어야 한다", () => {
		// Given
		const input = { completionRate: 30, rateChange: 20 };

		// When
		const result = selectProfileTemplate(input);

		// Then
		expect(result).toContain("공감 + 작은 성공 스포트라이트");
	});
});
