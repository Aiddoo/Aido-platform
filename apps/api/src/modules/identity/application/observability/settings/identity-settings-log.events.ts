export const IdentitySettingsLogEvent = {
  TIMEZONE_HEAL_FAILED: "identity.settings.timezone.heal.failed",
  TIMEZONE_HEAL_CLEANED: "identity.settings.timezone.heal.cleaned",
  PREFERENCE_UPDATED: "identity.settings.preference.updated",
  MARKETING_CONSENT_UPDATED: "identity.settings.marketing-consent.updated",
  MARKETING_PUSH_CONSENT_UPDATED: "identity.settings.marketing-push-consent.updated",
  STREAK_UPDATED: "identity.settings.streak.updated",
  STREAK_RECALCULATED: "identity.settings.streak.recalculated",
  STREAK_UPDATE_CONFLICT: "identity.settings.streak.update.conflict",
  STREAK_UPDATE_FAILED: "identity.settings.streak.update.failed",
} as const;
