// 인증 가드가 검증한 사용자를 두는 자리. 읽는 쪽은 각자 schema로 확인한다(Passport가 하던 선언을 대신한다)
declare global {
  namespace Express {
    interface Request {
      user?: unknown;
    }
  }
}

export {};
