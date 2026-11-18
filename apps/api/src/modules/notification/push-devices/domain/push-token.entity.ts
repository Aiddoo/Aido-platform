import { Entity } from "#api/shared/domain/model/entity";

import type { PushChannel } from "../../shared/domain/push-channel.constants.js";

export interface PushTokenPrimitives {
  readonly token: string | null;
  // 보고한 계약이 정한 발송 채널. 등록 API v1은 EXPO다
  readonly channel: PushChannel;
  readonly payloadVersion: number;
  readonly appVersion: string | null;
}

/**
 * 기기 하나의 발송 토큰 등록. 사용자·기기마다 한 행(PushToken_userId_deviceId_key)이라 기기로 찾고 따로 id를 두지 않는다.
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

  get channel(): PushChannel {
    return this.props.channel;
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
