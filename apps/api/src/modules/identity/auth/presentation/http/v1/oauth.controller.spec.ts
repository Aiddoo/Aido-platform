/**
 * OAuthController 단위 테스트
 *
 * @description
 * OAuth 컨트롤러의 교환 코드 엔드포인트를 검증한다.
 * 서비스 위임과 AuthMapper를 통한 응답 변환을 확인한다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test oauth.controller.spec.ts
 * ```
 */

import { TestBed } from "@suites/unit";
import type { Request } from "express";
import type { Mocked } from "vitest";
import { mock } from "vitest-mock-extended";

import { ExchangeOAuthCode } from "#api/modules/identity/auth/application/use-cases/exchange-oauth-code.use-case";
import { parseRequestClient } from "#api/platform/http/request-client/index";
import { TEST_REQUEST_ID } from "#test/mocks/request-client";

import type { ExchangeCodeDto } from "./auth-request.dto.js";
import { OAuthController } from "./oauth.controller.js";

describe("OAuthController — OAuth 인증 컨트롤러", () => {
  let controller: OAuthController;
  let exchangeOAuthCodeUseCase: Mocked<ExchangeOAuthCode>;
  const request = Object.assign(mock<Request>(), { headers: {} });
  const client = parseRequestClient({ "x-app-version": "1.14.2" }, TEST_REQUEST_ID);

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(OAuthController).compile();

    controller = unit;
    exchangeOAuthCodeUseCase = unitRef.get(ExchangeOAuthCode);
  });

  describe("exchangeCode", () => {
    it("교환 코드를 서비스에 위임하고 매퍼를 통해 토큰 응답을 반환해야 한다", async () => {
      // Given -교환 코드 DTO와 서비스 응답이 준비되었을 때
      const dto: ExchangeCodeDto = { code: "exchange-code-abc" };
      const serviceResult = {
        userId: "user-123",
        accessToken: "access-token",
        refreshToken: "refresh-token",
        userName: "테스터",
        profileImage: "https://example.com/photo.jpg",
        isNewUser: true,
      };
      exchangeOAuthCodeUseCase.execute.mockResolvedValue(serviceResult);

      // When -exchangeCode를 호출하면
      const result = await controller.exchangeCode(dto, request, client);

      // Then -서비스에 code를 전달하고 AuthMapper.toExchangeCodeResponse 형식의 응답을 반환해야 한다
      expect(exchangeOAuthCodeUseCase.execute).toHaveBeenCalledWith({
        code: dto.code,
        device: { appVersion: "1.14.2" },
      });
      expect(result).toEqual({
        userId: serviceResult.userId,
        accessToken: serviceResult.accessToken,
        refreshToken: serviceResult.refreshToken,
        name: serviceResult.userName,
        profileImage: serviceResult.profileImage,
        accountRestored: false,
        isNewUser: true,
      });
    });

    it("userName이 없으면 name을 null로 반환해야 한다", async () => {
      // Given -userName이 없는 서비스 응답이 준비되었을 때
      const dto: ExchangeCodeDto = { code: "exchange-code-xyz" };
      const serviceResult = {
        userId: "user-456",
        accessToken: "access-token-2",
        refreshToken: "refresh-token-2",
        userName: undefined,
        profileImage: undefined,
        isNewUser: false,
      };
      exchangeOAuthCodeUseCase.execute.mockResolvedValue(serviceResult);

      // When -exchangeCode를 호출하면
      const result = await controller.exchangeCode(dto, request, client);

      // Then -name과 profileImage가 null로 반환되어야 한다
      expect(result).toEqual({
        userId: serviceResult.userId,
        accessToken: serviceResult.accessToken,
        refreshToken: serviceResult.refreshToken,
        name: null,
        profileImage: null,
        accountRestored: false,
        isNewUser: false,
      });
    });
  });
});
