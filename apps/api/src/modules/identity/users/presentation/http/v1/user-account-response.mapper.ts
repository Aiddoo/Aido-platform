import type { currentUserSchema } from "@aido/api/contracts/auth/v1";
import type { z } from "zod";

import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";

import type { CurrentUserReadModel } from "../../../application/read-models/current-user.read-model.js";
import type {
  RegistrationReadModel,
  UpdatedProfileReadModel,
} from "../../../application/read-models/user-account.read-model.js";

export function toRegisterResponse(result: RegistrationReadModel) {
  return {
    message: result.message,
    email: result.email,
    emailSent: result.emailSent,
  };
}

export function toCurrentUserResponse(
  result: CurrentUserReadModel,
  appVersion?: string,
): z.input<typeof currentUserSchema> {
  return {
    userId: result.userId,
    email: result.email,
    sessionId: result.sessionId,
    role: result.role,
    userTag: result.userTag,
    status: result.status,
    emailVerifiedAt: result.emailVerifiedAt,
    subscriptionStatus: result.subscriptionStatus,
    subscriptionExpiresAt: result.subscriptionExpiresAt,
    name: result.name,
    profileImage: resolveProfileImage(result.profileImage, appVersion),
    createdAt: result.createdAt,
    providers: result.providers,
    premiumSource: result.premiumSource,
    premiumEndsAt: result.premiumEndsAt,
    premiumPeriodEndsAt: result.premiumPeriodEndsAt,
    willRenew: result.willRenew,
    bankedPremiumDays: result.bankedPremiumDays,
    premiumGrantEndedAt: result.premiumGrantEndedAt,
    premiumIsTrial: result.premiumIsTrial,
    premiumPlanType: result.premiumPlanType,
    isPremium: result.isPremium,
    entitlements: result.entitlements,
  };
}

export function toUpdateProfileResponse(result: UpdatedProfileReadModel, appVersion?: string) {
  return {
    message: result.message,
    name: result.name,
    profileImage: resolveProfileImage(result.profileImage, appVersion),
  };
}
