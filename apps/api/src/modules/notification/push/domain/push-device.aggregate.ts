import { ErrorCode } from "@aido/api/errors";
import type { PushDevicePlatform } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { AggregateRoot } from "#api/shared/domain/index";

import type { PushPermission } from "./push-permission.vo.js";

interface PushDeviceProps {
  readonly userId: string;
  readonly deviceId: string;
  /** 보고한 로그인 세션. 세션이 끝나면 이 기기는 푸시 대상에서 빠진다. */
  readonly sessionId: string | null;
  readonly platform: PushDevicePlatform;
  readonly permission: PushPermission;
  readonly token: string | null;
  readonly deviceModel: string | null;
  readonly osVersion: string | null;
  readonly reportedAt: Date;
}

interface ReportPushDeviceInput extends Omit<PushDeviceProps, "platform"> {
  readonly platform: PushDevicePlatform | null;
}

/** 한 사용자의 앱 설치 하나. 권한이 발송을 허용할 때만 토큰을 발송 대상으로 둔다. 모델·OS는 문의 대응용이다. */
export class PushDevice extends AggregateRoot<PushDeviceProps> {
  static report({ platform, ...input }: ReportPushDeviceInput): PushDevice {
    if (platform == null) {
      throw new DomainException(ErrorCode.NOTIFICATION_1006, { deviceId: input.deviceId });
    }
    return new PushDevice({ ...input, platform });
  }

  get userId(): string {
    return this.props.userId;
  }

  get deviceId(): string {
    return this.props.deviceId;
  }

  get sessionId(): string | null {
    return this.props.sessionId;
  }

  get platform(): PushDevicePlatform {
    return this.props.platform;
  }

  get permission(): PushPermission {
    return this.props.permission;
  }

  get deviceModel(): string | null {
    return this.props.deviceModel;
  }

  get osVersion(): string | null {
    return this.props.osVersion;
  }

  get reportedAt(): Date {
    return new Date(this.props.reportedAt);
  }

  get deliverableToken(): string | null {
    return this.props.permission.allowsDelivery ? this.props.token : null;
  }
}
