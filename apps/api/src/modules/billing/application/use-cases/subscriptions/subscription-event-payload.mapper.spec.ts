import { premiumGrantImpactOf } from "./subscription-event-payload.mapper.js";

describe("premiumGrantImpactOf — 보상 기간 영향", () => {
  const none = {
    source: null,
    endsAt: null,
    periodEndsAt: null,
    willRenew: false,
    bankedDays: 0,
    recentGrantEndedAt: null,
    isTrial: false,
    planType: null,
  };

  it.each([
    { label: "보상이 없으면", access: none, expected: undefined },
    {
      label: "스토어 뒤로 쌓아 두면",
      access: { ...none, source: "STORE" as const, bankedDays: 7 },
      expected: { bankedDays: 7, grantPeriodEndsAt: null },
    },
    {
      label: "보상 기간이 이어지면",
      access: {
        ...none,
        source: "GRANT" as const,
        periodEndsAt: new Date("2028-03-04T00:00:00.000Z"),
      },
      expected: { bankedDays: 0, grantPeriodEndsAt: "2028-03-04T00:00:00.000Z" },
    },
  ])("$label 영향은 $expected다", ({ access, expected }) => {
    // When / Then
    expect(premiumGrantImpactOf(access)).toEqual(expected);
  });
});
