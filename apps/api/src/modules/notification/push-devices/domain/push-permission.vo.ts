import { isDeliverablePushPermission, type PushPermissionStatus } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

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
    return isDeliverablePushPermission(this.value.status);
  }
}
