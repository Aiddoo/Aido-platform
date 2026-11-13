import { z } from "zod";

/**
 * 출시 앱이 번들한 app-config raw 응답 스키마를 손으로 고정한 사본. 현재 계약에서 파생하지 않는다.
 * 다른 응답과 달리 출시 앱이 strict로 읽어 칸 하나만 더해도 파싱이 실패하므로 여기서도 strict를 쓴다.
 */

// 1.10.0~1.15.1 `@aido/validators`·`@aido/api` app-version.response.ts
const releasedAppStoreVersionSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
const releasedPlatformVersionSchema = z.strictObject({
  latestVersion: releasedAppStoreVersionSchema,
});

export const releasedAppVersionResponseSchema = z.discriminatedUnion("enabled", [
  z.strictObject({ enabled: z.literal(false) }),
  z.strictObject({
    enabled: z.literal(true),
    ios: releasedPlatformVersionSchema,
    android: releasedPlatformVersionSchema,
  }),
]);

// 1.8.0~1.15.1 `@aido/validators`·`@aido/api` feature-discovery.response.ts
const releasedMinAppVersionSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  );
const releasedLaunchedAtSchema = z
  .string()
  .regex(
    /^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?Z$/,
  );

export const releasedFeatureDiscoveryResponseSchema = z.discriminatedUnion("enabled", [
  z.strictObject({ enabled: z.literal(false) }),
  z.strictObject({
    enabled: z.literal(true),
    campaignId: z.string().min(1),
    minAppVersion: releasedMinAppVersionSchema,
    launchedAt: releasedLaunchedAtSchema,
    autoOpen: z.boolean(),
  }),
]);
