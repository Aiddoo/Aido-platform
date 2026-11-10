const APP_RELEASE_PLATFORMS = ["ios", "android"] as const;

export type AppReleasePlatform = (typeof APP_RELEASE_PLATFORMS)[number];
