import { ErrorCode } from "@aido/api/errors";
import { describe, expect, it } from "vitest";

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
    const target = UserReportTarget.of(type, contentId);

    // Then
    expect(target.contentId).toBe(contentId);
  });

  it.each([
    { type: "PROFILE", contentId: "42" },
    { type: "TODO", contentId: null },
    { type: "TODO", contentId: "0" },
    { type: "NUDGE_MESSAGE", contentId: "clz7x5p8k0099qz0z8z8z8z8z" },
    { type: "COMMENT", contentId: "42" },
  ] as const)("$type 대상에 맞지 않는 ID($contentId)는 거부한다", ({ type, contentId }) => {
    // When
    const create = () => UserReportTarget.of(type, contentId);

    // Then
    expect(create).toThrow(expect.objectContaining({ errorCode: ErrorCode.REPORT_2253 }));
  });
});
