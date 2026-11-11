import { ErrorCode } from "@aido/api/errors";
import type { PushDevicePlatform, PushPermissionStatus } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { PushDeviceId } from "./push-device-id.vo.js";
import { PushPermission } from "./push-permission.vo.js";

export interface PushDevicePrimitives {
  readonly deviceId: string;
  readonly userId: string;
  readonly sessionId: string | null;
  readonly platform: PushDevicePlatform;
  readonly permissionStatus: PushPermissionStatus;
  readonly permissionCanAskAgain: boolean;
  readonly token: string | null;
  readonly deviceModel: string | null;
  readonly osVersion: string | null;
  readonly reportedAt: Temporal.Instant;
}

// 보고 하나가 이 기기의 발송 토큰을 어떻게 바꾸는지
export type PushTokenChange =
  | { readonly kind: "REGISTER"; readonly token: string }
  | { readonly kind: "KEEP" }
  | { readonly kind: "RELEASE" };

interface PushDeviceProps {
  readonly userId: UserId;
  // 세션을 폐기하면(로그아웃 등) 이 기기는 푸시 대상에서 빠진다. 만료만으로는 빠지지 않는다
  readonly sessionId: string | null;
  readonly platform: PushDevicePlatform;
  readonly permission: PushPermission;
  readonly token: string | null;
  readonly deviceModel: string | null;
  readonly osVersion: string | null;
  readonly reportedAt: Temporal.Instant;
}

interface CreatePushDeviceParams {
  readonly id: PushDeviceId;
  readonly userId: UserId;
  readonly sessionId: string | null;
  // deviceId 접두어와 헤더 어디에서도 플랫폼을 알 수 없으면 null이다
  readonly platform: PushDevicePlatform | null;
  readonly permission: PushPermission;
  readonly token: string | null;
  readonly deviceModel: string | null;
  readonly osVersion: string | null;
  readonly now: Temporal.Instant;
}

// 한 사용자의 앱 설치 하나. 권한이 발송을 허용할 때만 토큰을 발송 대상으로 둔다. 모델·OS는 문의 대응용이다
export class PushDevice extends AggregateRoot<PushDeviceId, PushDeviceProps> {
  static create(params: CreatePushDeviceParams): PushDevice {
    if (params.platform == null) {
      throw new DomainException(ErrorCode.NOTIFICATION_1006, { deviceId: params.id.value });
    }
    return new PushDevice(params.id, {
      userId: params.userId,
      sessionId: params.sessionId,
      platform: params.platform,
      permission: params.permission,
      token: params.token,
      deviceModel: params.deviceModel,
      osVersion: params.osVersion,
      reportedAt: params.now,
    });
  }

  static reconstitute(primitives: PushDevicePrimitives): PushDevice {
    return new PushDevice(PushDeviceId.reconstitute(primitives.deviceId), {
      userId: UserId.reconstitute(primitives.userId),
      sessionId: primitives.sessionId,
      platform: primitives.platform,
      permission: PushPermission.reconstitute({
        status: primitives.permissionStatus,
        canAskAgain: primitives.permissionCanAskAgain,
      }),
      token: primitives.token,
      deviceModel: primitives.deviceModel,
      osVersion: primitives.osVersion,
      reportedAt: primitives.reportedAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
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

  get reportedAt(): Temporal.Instant {
    return this.props.reportedAt;
  }

  get tokenChange(): PushTokenChange {
    if (!this.props.permission.allowsDelivery) {
      return { kind: "RELEASE" };
    }
    // 허용인데 토큰이 없으면 발급이 한 번 실패한 것이라(시간 초과·오프라인) 등록된 토큰을 지우지 않는다
    if (this.props.token == null) {
      return { kind: "KEEP" };
    }
    return { kind: "REGISTER", token: this.props.token };
  }

  toPrimitives(): PushDevicePrimitives {
    return {
      deviceId: this.id.value,
      userId: this.props.userId.value,
      sessionId: this.props.sessionId,
      platform: this.props.platform,
      permissionStatus: this.props.permission.status,
      permissionCanAskAgain: this.props.permission.canAskAgain,
      token: this.props.token,
      deviceModel: this.props.deviceModel,
      osVersion: this.props.osVersion,
      reportedAt: this.props.reportedAt,
    };
  }
}
