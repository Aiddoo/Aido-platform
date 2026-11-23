import { NOTIFICATION_PURPOSES } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import type { NotificationId } from "../../notifications/domain/notification-id.vo.js";
import {
  PUSH_DELIVERY_MODES,
  type PushDeliveryMode,
  type PushDispatchStatus,
} from "./push-delivery-status.constants.js";
import type { PushDispatchId } from "./push-dispatch-id.vo.js";
import { pushDispatchFieldInvalid } from "./push-dispatches.errors.js";

type NotificationPurpose = (typeof NOTIFICATION_PURPOSES)[number];

// 캠페인 키·변형 id 칸 길이(varchar 100)다
const CAMPAIGN_LABEL_MAX_LENGTH = 100;

function fitsCampaignLabel(label: string | null): boolean {
  return label == null || label.length <= CAMPAIGN_LABEL_MAX_LENGTH;
}

interface PushDispatchProps {
  readonly notificationId: NotificationId;
  readonly recipientId: UserId;
  readonly purpose: NotificationPurpose;
  readonly campaignKey: string | null;
  readonly variantId: string | null;
  readonly status: PushDispatchStatus;
  readonly deliveryMode: PushDeliveryMode;
  readonly force: boolean;
  readonly stagedAt: Temporal.Instant;
}

export interface CreatePushDispatchParams {
  readonly id: PushDispatchId;
  readonly notificationId: NotificationId;
  readonly recipientId: UserId;
  readonly purpose: NotificationPurpose;
  readonly campaignKey: string | null;
  readonly variantId: string | null;
  readonly deliveryMode: PushDeliveryMode;
  readonly force: boolean;
  readonly now: Temporal.Instant;
}

export interface PushDispatchPrimitives {
  readonly id: number;
  readonly notificationId: number;
  readonly recipientId: string;
  readonly purpose: NotificationPurpose;
  readonly campaignKey: string | null;
  readonly variantId: string | null;
  readonly status: PushDispatchStatus;
  readonly deliveryMode: PushDeliveryMode;
  readonly force: boolean;
  readonly stagedAt: Temporal.Instant;
}

/**
 * 알림 하나를 한 사용자의 기기들로 보내는 일. 알림과 같은 트랜잭션에서 PENDING으로 만들고 아웃박스를 함께 연다.
 * 그 뒤의 claim·마무리·lease는 수백 건을 한 문장으로 옮기는 단계 저장소가 맡는다.
 */
export class PushDispatch extends AggregateRoot<PushDispatchId, PushDispatchProps> {
  static create(params: CreatePushDispatchParams): PushDispatch {
    if (params.recipientId.value.length === 0) {
      throw pushDispatchFieldInvalid("recipientId");
    }
    if (!NOTIFICATION_PURPOSES.includes(params.purpose)) {
      throw pushDispatchFieldInvalid("purpose");
    }
    if (!PUSH_DELIVERY_MODES.includes(params.deliveryMode)) {
      throw pushDispatchFieldInvalid("deliveryMode");
    }
    if (!fitsCampaignLabel(params.campaignKey)) {
      throw pushDispatchFieldInvalid("campaignKey");
    }
    if (!fitsCampaignLabel(params.variantId)) {
      throw pushDispatchFieldInvalid("variantId");
    }
    return new PushDispatch(params.id, {
      notificationId: params.notificationId,
      recipientId: params.recipientId,
      purpose: params.purpose,
      campaignKey: params.campaignKey,
      variantId: params.variantId,
      status: "PENDING",
      deliveryMode: params.deliveryMode,
      force: params.force,
      stagedAt: params.now,
    });
  }

  toPrimitives(): PushDispatchPrimitives {
    return {
      id: this.id.value,
      notificationId: this.props.notificationId.value,
      recipientId: this.props.recipientId.value,
      purpose: this.props.purpose,
      campaignKey: this.props.campaignKey,
      variantId: this.props.variantId,
      status: this.props.status,
      deliveryMode: this.props.deliveryMode,
      force: this.props.force,
      stagedAt: this.props.stagedAt,
    };
  }
}
