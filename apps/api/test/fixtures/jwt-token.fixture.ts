import { generateKeyPairSync } from "node:crypto";

import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { Strategy } from "passport-jwt";

import { mockOf } from "#test/mocks/index";

export type JwtTestAlgorithm = "HS256" | "HS512" | "RS256" | "none";
export type PassportOutcome = "success" | "fail" | "error";

const jwtService = new JwtService();

function encodeSegment(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

/** 알고리즘 고정 검증용으로 같은 payload를 여러 서명 방식으로 만든다. */
export function signJwtWithAlgorithm(
  payload: object,
  secret: string,
  algorithm: JwtTestAlgorithm,
): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims = { ...payload, iat: issuedAt, exp: issuedAt + 900 };

  if (algorithm === "none") {
    return `${encodeSegment({ alg: "none", typ: "JWT" })}.${encodeSegment(claims)}.`;
  }
  if (algorithm === "RS256") {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    return jwtService.sign(claims, { privateKey, algorithm });
  }
  return jwtService.sign(claims, { secret, algorithm });
}

export function decodeJwtSegment(token: string, index: 0 | 1): unknown {
  const segment = token.split(".")[index] ?? "";
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

/** passport 전략에 Bearer 토큰을 넣어 서명 검증과 validate까지 통과했는지 본다. */
export function authenticateBearer(strategy: Strategy, token: string): Promise<PassportOutcome> {
  return new Promise((resolve) => {
    strategy.success = () => resolve("success");
    strategy.fail = () => resolve("fail");
    strategy.error = () => resolve("error");
    strategy.authenticate(mockOf<Request>({ headers: { authorization: `Bearer ${token}` } }));
  });
}
