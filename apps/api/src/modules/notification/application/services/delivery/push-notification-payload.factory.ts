import { NOTIFICATION_ACTION_TYPE, type PushNotificationData } from "@aido/api";

import { FEATURE_DISCOVERY_CAMPAIGN_KEY } from "../../../domain/services/delivery/feature-marketing-capability.js";
import {
  notificationMinAppVersion,
  toWireNotificationType,
} from "../../../domain/services/delivery/notification-client-capability.js";
import { isMarketingNotification } from "../../../domain/services/delivery/push-eligibility.js";
import { type MarketingPushOptOutTokenPort } from "../../ports/delivery/marketing-push-opt-out-token.port.js";
import type { CreateNotificationData } from "../../ports/delivery/notification-data.js";
import type { PushPayload } from "../../ports/delivery/push-provider.port.js";
import { toNotificationNavigation } from "./notification-navigation.js";
import { toNotificationRouting } from "./notification-routing.js";

interface CreatePushNotificationPayloadInput {
  readonly data: CreateNotificationData;
  readonly notificationId: number;
  readonly dispatchId: number;
}

export interface BatchPushNotificationPayload extends Omit<PushPayload, "token"> {
  readonly userId: string;
  readonly dispatchId: number;
  readonly requiresFeatureCapability: boolean;
  /** 이 버전 미만 기기에는 보내지 않는다. 없으면 모든 활성 기기 대상이다. */
  readonly minAppVersion?: string;
}

/** 모바일 라우팅·컨텍스트·마케팅 메타데이터를 푸시 provider payload로 변환한다. */
interface PushNotificationPayloadFactoryDependencies {
  readonly marketingOptOutTokens: Pick<MarketingPushOptOutTokenPort, "issue">;
}

export class PushNotificationPayloadFactory {
  readonly #dependencies: PushNotificationPayloadFactoryDependencies;

  constructor(dependencies: PushNotificationPayloadFactoryDependencies) {
    this.#dependencies = dependencies;
  }

  createSingle(input: CreatePushNotificationPayloadInput): Omit<PushPayload, "token"> {
    const { data, notificationId, dispatchId } = input;
    return {
      title: data.title,
      body: data.body,
      data: {
        ...this.#createNotificationData(data, notificationId),
        dispatchId,
      },
      ...((data.purpose === "ENGAGEMENT" || isMarketingNotification(data.type)) && {
        categoryId: "MARKETING",
      }),
    };
  }

  createBatch(input: CreatePushNotificationPayloadInput): BatchPushNotificationPayload {
    const { data, dispatchId } = input;
    const minAppVersion = notificationMinAppVersion(data.type);
    return {
      userId: data.userId,
      dispatchId,
      requiresFeatureCapability: data.campaignKey === FEATURE_DISCOVERY_CAMPAIGN_KEY,
      ...(minAppVersion != null && { minAppVersion }),
      ...this.createSingle(input),
    };
  }

  #createNotificationData(
    data: CreateNotificationData,
    notificationId: number,
  ): PushNotificationData {
    const action = data.action ?? {
      type: NOTIFICATION_ACTION_TYPE.DEEP_LINK,
      url: undefined,
    };
    const context: PushNotificationData["context"] = {};
    if (data.todoId) {
      context.todoId = data.todoId;
    }
    if (data.friendId) {
      context.friendId = data.friendId;
    }
    if (data.nudgeId) {
      context.nudgeId = data.nudgeId;
    }
    if (data.cheerId) {
      context.cheerId = data.cheerId;
    }
    const routing = toNotificationRouting(data.metadata);
    const navigation = toNotificationNavigation({ ...data, routing });

    return {
      notificationId,
      type: toWireNotificationType(data.type),
      action: {
        type: action.type,
        ...(action.url && { url: action.url }),
      },
      ...(Object.keys(context).length > 0 && { context }),
      ...(routing && { routing }),
      ...(navigation && { navigation }),
      ...(data.campaignKey && { campaignKey: data.campaignKey }),
      ...(data.variantId && { variantId: data.variantId }),
      ...(data.purpose && { purpose: data.purpose }),
      ...((data.purpose === "ENGAGEMENT" || isMarketingNotification(data.type)) && {
        marketingOptOutToken: this.#dependencies.marketingOptOutTokens.issue(data.userId),
      }),
    };
  }
}
