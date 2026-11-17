// 서명·알고리즘·발급자·대상·만료를 발급과 같은 값으로 확인한 토큰의 claim이다. 하나라도 틀리면 null이고 claim 모양은 가드가 본다
export abstract class TokenVerifierPort {
  abstract verifyAccessToken(token: string): Promise<unknown>;
  abstract verifyRefreshToken(token: string): Promise<unknown>;
}
