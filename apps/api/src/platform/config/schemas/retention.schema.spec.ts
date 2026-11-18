import { retentionSchema } from "./retention.schema.js";

describe("retentionSchema — 신규 가입자 리텐션 실험 설정", () => {
  it("미설정 시 실험을 비활성화하고 treatment 비율을 50으로 둔다", () => {
    // When
    const config = retentionSchema.parse({});

    // Then
    expect(config).toEqual({
      RETENTION_ONBOARDING_V2_ENABLED: false,
      RETENTION_ONBOARDING_V2_TREATMENT_PERCENT: 50,
    });
  });

  it("문자열 환경변수를 boolean과 number로 변환한다", () => {
    // When
    const config = retentionSchema.parse({
      RETENTION_ONBOARDING_V2_ENABLED: "true",
      RETENTION_ONBOARDING_V2_TREATMENT_PERCENT: "25",
    });

    // Then
    expect(config.RETENTION_ONBOARDING_V2_ENABLED).toBe(true);
    expect(config.RETENTION_ONBOARDING_V2_TREATMENT_PERCENT).toBe(25);
  });

  it.each([-1, 101])("treatment 비율 %s를 거부한다", (treatmentPercent) => {
    // When
    const parse = () =>
      retentionSchema.parse({
        RETENTION_ONBOARDING_V2_TREATMENT_PERCENT: treatmentPercent,
      });

    // Then
    expect(parse).toThrow();
  });
});
