import { Entity } from "#api/shared/domain/model/entity";

export interface PushTokenPrimitives {
  readonly token: string | null;
  readonly payloadVersion: number;
  readonly appVersion: string | null;
}

/**
 * 기기 하나의 Expo 발송 토큰 등록. 사용자·기기마다 한 행(PushToken_userId_deviceId_key)이라 기기로 찾고 따로 id를 두지 않는다.
 * 이번 보고에 토큰 값이 없으면(발급 실패) 등록된 토큰을 두고 세션·앱 정보만 맞춘다.
 */
export class PushToken extends Entity<null, PushTokenPrimitives> {
  static create(params: PushTokenPrimitives): PushToken {
    return new PushToken(null, { ...params });
  }

  static reconstitute(primitives: PushTokenPrimitives): PushToken {
    return new PushToken(null, { ...primitives });
  }

  get token(): string | null {
    return this.props.token;
  }

  get payloadVersion(): number {
    return this.props.payloadVersion;
  }

  get appVersion(): string | null {
    return this.props.appVersion;
  }

  toPrimitives(): PushTokenPrimitives {
    return { ...this.props };
  }
}
