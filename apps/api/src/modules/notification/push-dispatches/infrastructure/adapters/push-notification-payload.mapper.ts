import type { PushNotificationData } from "@aido/api/contracts/notification/v1";
import {
  MARKETING_PUSH_CATEGORY_ID,
  NOTIFICATION_ACTION_TYPE,
  TODO_REMINDER_PUSH_CATEGORY_ID,
} from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { withMarketingPushLabel } from "../../../shared/application/messages/marketing-push-label.messages.js";
import {
  notificationMinAppVersion,
  toWireNotificationType,
} from "../../../shared/domain/notification-client-capability.domain-service.js";
import type { CreateNotificationData } from "../../../shared/domain/notification-draft.constants.js";
import { isActionableTodoReminderStage } from "../../../shared/domain/todo-reminder-stage.constants.js";
import { type MarketingPushOptOutTokenPort } from "../../application/ports/marketing-push-opt-out-token.port.js";
import type { PushMessageContent } from "../../application/ports/push-channel.port.js";
import {
  type BatchPushNotificationPayload,
  type CreatePushNotificationPayloadInput,
  PushNotificationPayloadPort,
} from "../../application/ports/push-notification-payload.port.js";
import { FEATURE_DISCOVERY_CAMPAIGN_KEY } from "../../domain/feature-marketing-capability.domain-service.js";
import { PushCategoryId } from "../../domain/push-category-id.vo.js";
import { PUSH_DELIVERY_PRIORITY } from "../../domain/push-delivery-options.domain-service.js";
import { isMarketingNotification } from "../../domain/push-eligibility.domain-service.js";
import { toNotificationNavigation } from "./notification-navigation.mapper.js";
import { toNotificationRouting } from "./notification-routing.mapper.js";

/** 광고성 동의가 필요한 푸시. 표기·카테고리·수신 거부 토큰이 모두 이 판단을 따른다. */
function isMarketingPush(data: CreateNotificationData): boolean {
  return data.purpose === "ENGAGEMENT" || isMarketingNotification(data.type);
}

/**
 * 버튼 카테고리. 앱이 같은 id로 버튼을 등록하고, 등록하지 않은 앱은 버튼 없이 보여 앱 버전으로 나누지 않는다.
 * 리마인드 버튼은 할 일을 알리는 단계에만 붙는다(반복 알림 멈춤 안내에는 없다)
 */
function pushCategoryIdOf(
  data: CreateNotificationData,
  isMarketing: boolean,
): PushCategoryId | null {
  if (isMarketing) {
    return PushCategoryId.reconstitute(MARKETING_PUSH_CATEGORY_ID);
  }
  if (data.type === "TODO_REMINDER" && isActionableTodoReminderStage(data.metadata?.stage)) {
    return PushCategoryId.reconstitute(TODO_REMINDER_PUSH_CATEGORY_ID);
  }
  return null;
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

  createSingle(input: CreatePushNotificationPayloadInput): PushMessageContent {
    const { data, notificationId, dispatchId } = input;
    const isMarketing = isMarketingPush(data);
    const categoryId = pushCategoryIdOf(data, isMarketing);
    // 광고성 표기는 푸시 문구에만 붙인다. 알림함 기록은 원래 문구 그대로다
    const content = isMarketing
      ? withMarketingPushLabel(data, input.locale)
      : { title: data.title, body: data.body };
    return {
      title: content.title,
      body: content.body,
      data: {
        ...this.#createNotificationData(data, notificationId.value),
        dispatchId: dispatchId.value,
      },
      ttlSeconds: input.ttlSeconds,
      priority: PUSH_DELIVERY_PRIORITY,
      ...(categoryId != null && { categoryId }),
    };
  }

  createBatch(input: CreatePushNotificationPayloadInput): BatchPushNotificationPayload {
    const { data, dispatchId } = input;
    const minAppVersion = notificationMinAppVersion(data.type);
    return {
      userId: UserId.reconstitute(data.userId),
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
        marketingOptOutToken: this.#dependencies.marketingOptOutTokens.issue(
          UserId.reconstitute(data.userId),
        ),
      }),
    };
  }
}
