import { ErrorCode } from "@aido/api/errors";

import { UserReportTarget } from "./user-report-target.vo.js";

describe("UserReportTarget", () => {
  it.each([
    { type: "PROFILE", contentId: null },
    { type: "TODO", contentId: "42" },
    { type: "NUDGE_MESSAGE", contentId: "7" },
    { type: "CHEER_MESSAGE", contentId: "1" },
    { type: "COMMENT", contentId: "clz7x5p8k0099qz0z8z8z8z8z" },
  ] as const)("$type 대상은 $contentId ID 형식을 받는다", ({ type, contentId }) => {
    // When
    const target = UserReportTarget.create({ type, contentId });

    // Then
    expect(target.contentId).toBe(contentId);
  });

  it.each([
    { type: "PROFILE", contentId: "42" },
    { type: "TODO", contentId: null },
    { type: "TODO", contentId: "0" },
    { type: "NUDGE_MESSAGE", contentId: "clz7x5p8k0099qz0z8z8z8z8z" },
    { type: "COMMENT", contentId: "42" },
  ] as const)(
    "$type 대상에 맞지 않는 ID($contentId)는 REPORT_2253으로 거부한다",
    ({ type, contentId }) => {
      // When
      const create = () => UserReportTarget.create({ type, contentId });

      // Then
      expect(create).toThrow(
        expect.objectContaining({
          errorCode: ErrorCode.REPORT_2253,
          details: { targetType: type },
        }),
      );
    },
  );

  it("종류와 콘텐츠 ID가 같으면 같은 대상이다", () => {
    // Given
    const target = UserReportTarget.create({ type: "TODO", contentId: "42" });

    // When
    const comparisons = [
      target.equals(UserReportTarget.reconstitute({ type: "TODO", contentId: "42" })),
      target.equals(UserReportTarget.reconstitute({ type: "TODO", contentId: "43" })),
      target.equals(UserReportTarget.reconstitute({ type: "NUDGE_MESSAGE", contentId: "42" })),
    ];

    // Then
    expect(comparisons).toEqual([true, false, false]);
  });
});
