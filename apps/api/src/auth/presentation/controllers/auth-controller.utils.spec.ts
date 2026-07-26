import type { Request } from "express";
import { extractMetadata } from "./auth-controller.utils";

describe("extractMetadata", () => {
	it("감사 IP는 전달 헤더의 왼쪽 값이 아니라 Express가 확정한 req.ip를 사용한다", () => {
		// Given - 신뢰 프록시가 확정한 canonical IP와 공격자가 붙인 왼쪽 값
		const req = {
			ip: "198.51.100.24",
			headers: {
				"x-forwarded-for": "203.0.113.99, 198.51.100.24",
				"user-agent": "request-identity-test",
			},
		} as unknown as Request;

		// When
		const metadata = extractMetadata(req);

		// Then
		expect(metadata).toEqual({
			ip: "198.51.100.24",
			userAgent: "request-identity-test",
			deviceName: undefined,
			deviceType: undefined,
		});
	});
});
