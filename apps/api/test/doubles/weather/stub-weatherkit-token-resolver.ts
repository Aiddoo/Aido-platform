/** 서명 대신 순서대로 토큰을 내주고 무효화 횟수를 기록한다. */
export class StubWeatherKitTokenResolver {
  readonly issued: string[] = [];
  invalidations = 0;
  failure: Error | null = null;

  async resolve(): Promise<string> {
    if (this.failure !== null) {
      throw this.failure;
    }
    const token = `synthetic.jwt.token-${this.invalidations + 1}`;
    this.issued.push(token);
    return token;
  }

  invalidate(): void {
    this.invalidations += 1;
  }
}
