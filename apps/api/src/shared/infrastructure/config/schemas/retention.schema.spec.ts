import { retentionSchema } from "./retention.schema";

describe("retentionSchema — 신규 가입자 리텐션 실험 설정", () => {
	it("미설정 시 실험을 비활성화하고 treatment 비율을 50으로 둔다", () => {
		const config = retentionSchema.parse({});

		expect(config).toEqual({
			RETENTION_ONBOARDING_V2_ENABLED: false,
			RETENTION_ONBOARDING_V2_TREATMENT_PERCENT: 50,
		});
	});

	it("문자열 환경변수를 boolean과 number로 변환한다", () => {
		const config = retentionSchema.parse({
			RETENTION_ONBOARDING_V2_ENABLED: "true",
			RETENTION_ONBOARDING_V2_TREATMENT_PERCENT: "25",
		});

		expect(config.RETENTION_ONBOARDING_V2_ENABLED).toBe(true);
		expect(config.RETENTION_ONBOARDING_V2_TREATMENT_PERCENT).toBe(25);
	});

	it.each([-1, 101])("treatment 비율 %s를 거부한다", (treatmentPercent) => {
		expect(() =>
			retentionSchema.parse({
				RETENTION_ONBOARDING_V2_TREATMENT_PERCENT: treatmentPercent,
			}),
		).toThrow();
	});
});
