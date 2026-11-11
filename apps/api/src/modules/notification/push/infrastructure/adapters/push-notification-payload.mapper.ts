import type { PushNotificationData } from "@aido/api/contracts/notification";
import { NOTIFICATION_ACTION_TYPE } from "@aido/api/vocabulary";

import { DEFAULT_LOCALE } from "#api/shared/domain/locale";

import type { CreateNotificationData } from "../../../inbox/application/ports/notification-draft.port.js";
import { withMarketingPushLabel } from "../../application/messages/marketing-push-label.messages.js";
import { type MarketingPushOptOutTokenPort } from "../../application/ports/marketing-push-opt-out-token.port.js";
import {
  type BatchPushNotificationPayload,
  type CreatePushNotificationPayloadInput,
  PushNotificationPayloadPort,
} from "../../application/ports/push-notification-payload.port.js";
import type { PushPayload } from "../../application/ports/push-provider.port.js";
import { FEATURE_DISCOVERY_CAMPAIGN_KEY } from "../../domain/feature-marketing-capability.domain-service.js";
import {
  notificationMinAppVersion,
  toWireNotificationType,
} from "../../domain/notification-client-capability.domain-service.js";
import { pushDeliveryOptions } from "../../domain/push-delivery-options.constants.js";
import { isMarketingNotification } from "../../domain/push-eligibility.domain-service.js";
import { toNotificationNavigation } from "./notification-navigation.mapper.js";
import { toNotificationRouting } from "./notification-routing.mapper.js";

/** 광고성 동의가 필요한 푸시. 표기·카테고리·수신 거부 토큰이 모두 이 판단을 따른다. */
function isMarketingPush(data: CreateNotificationData): boolean {
  return data.purpose === "ENGAGEMENT" || isMarketingNotification(data.type);
}

/** 모바일 라우팅·컨텍스트·마케팅 메타데이터를 푸시 provider payload로 변환한다. */
interface PushNotificationPayloadFactoryDependencies {
  readonly marketingOptOutTokens: Pick<MarketingPushOptOutTokenPort, "issue">;
}

export class PushNotificationPayloadMapper extends PushNotificationPayloadPort {
  readonly #dependencies: PushNotificationPayloadFactoryDependencies;

  constructor(dependencies: PushNotificationPayloadFactoryDependencies) {
    super();
    this.#dependencies = dependencies;
  }

  createSingle(input: CreatePushNotificationPayloadInput): Omit<PushPayload, "token"> {
    const { data, notificationId, dispatchId } = input;
    const isMarketing = isMarketingPush(data);
    // 광고성 표기는 푸시 문구에만 붙인다. 알림함 기록은 원래 문구 그대로다
    const content = isMarketing
      ? withMarketingPushLabel(data, input.locale ?? DEFAULT_LOCALE)
      : { title: data.title, body: data.body };
    return {
      title: content.title,
      body: content.body,
      data: {
        ...this.#createNotificationData(data, notificationId),
        dispatchId,
      },
      ...pushDeliveryOptions(data.type),
      ...(isMarketing && { categoryId: "MARKETING" }),
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
      ...(isMarketingPush(data) && {
        marketingOptOutToken: this.#dependencies.marketingOptOutTokens.issue(data.userId),
      }),
    };
  }
}
