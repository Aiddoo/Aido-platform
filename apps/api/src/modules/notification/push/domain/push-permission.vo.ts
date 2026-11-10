import type { PushPermissionStatus } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { permissionAllowsDelivery } from "./push-device.domain-service.js";

interface PushPermissionValue {
  readonly status: PushPermissionStatus;
  readonly canAskAgain: boolean;
}

// 앱이 OS에서 읽은 알림 권한
export class PushPermission extends ValueObject<PushPermissionValue> {
  static create(value: PushPermissionValue): PushPermission {
    return new PushPermission({ status: value.status, canAskAgain: value.canAskAgain });
  }

  static reconstitute(value: PushPermissionValue): PushPermission {
    return new PushPermission({ status: value.status, canAskAgain: value.canAskAgain });
  }

  get status(): PushPermissionStatus {
    return this.value.status;
  }

  get canAskAgain(): boolean {
    return this.value.canAskAgain;
  }

  get allowsDelivery(): boolean {
    return permissionAllowsDelivery(this.value.status);
  }
}
