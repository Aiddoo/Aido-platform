export abstract class PasswordHasherPort {
  abstract hash(password: string): Promise<string>;
  abstract verify(hash: string, password: string): Promise<boolean>;
  /** 확인할 hash가 없을 때(계정·비밀번호 없음) verify와 같은 비용을 쓴다. 결과는 버린다 */
  abstract verifyAgainstDummyHash(password: string): Promise<void>;
  abstract needsRehash(hash: string): boolean;
}
