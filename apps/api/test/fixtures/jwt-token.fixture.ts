import { generateKeyPairSync } from "node:crypto";

import { JwtService } from "@nestjs/jwt";

export type JwtTestAlgorithm = "HS256" | "HS512" | "RS256" | "none";

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
  const issuedAt = Math.floor(Date.now() / 1_000);
  const claims = { ...payload, iat: issuedAt, exp: issuedAt + 900 };

  if (algorithm === "none") {
    return `${encodeSegment({ alg: "none", typ: "JWT" })}.${encodeSegment(claims)}.`;
  }
  if (algorithm === "RS256") {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2_048 });
    return jwtService.sign(claims, { privateKey, algorithm });
  }
  return jwtService.sign(claims, { secret, algorithm });
}

export function decodeJwtSegment(token: string, index: 0 | 1): unknown {
  const segment = token.split(".")[index] ?? "";
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}
