import { featureDiscoveryMinAppVersionSchema } from '@aido/api';
import { userSchema } from '@src/features/user/models/user.model';
import { z } from 'zod';

export const featureDiscoveryConfigSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    campaignId: z.string(),
    minAppVersion: z.string(),
    launchedAt: z.date(),
    autoOpen: z.boolean(),
  }),
]);
export type FeatureDiscoveryConfig = z.infer<typeof featureDiscoveryConfigSchema>;
const featureDiscoveryEligibilitySchema = z.object({
  authStatus: z.enum(['loading', 'locked', 'authenticated', 'unauthenticated']),
  config: featureDiscoveryConfigSchema.optional(),
  user: userSchema.pick({ createdAt: true }).optional(),
  appVersion: z.string().optional(),
  hasBundledCampaign: z.boolean(),
  hasSeen: z.boolean(),
});
type FeatureDiscoveryEligibility = z.infer<typeof featureDiscoveryEligibilitySchema>;
const parsedSemanticVersionSchema = z.object({
  core: z.tuple([z.number(), z.number(), z.number()]).readonly(),
  prerelease: z.array(z.string()).readonly().nullable(),
});
type ParsedSemanticVersion = z.infer<typeof parsedSemanticVersionSchema>;

function parseSemanticVersion(value: string | undefined): ParsedSemanticVersion | null {
  if (!value || !featureDiscoveryMinAppVersionSchema.safeParse(value).success) {
    return null;
  }

  const withoutBuild = value.split('+', 1)[0];
  if (!withoutBuild) {
    return null;
  }

  const prereleaseSeparatorIndex = withoutBuild.indexOf('-');
  const corePart =
    prereleaseSeparatorIndex === -1
      ? withoutBuild
      : withoutBuild.slice(0, prereleaseSeparatorIndex);
  const prereleasePart =
    prereleaseSeparatorIndex === -1 ? undefined : withoutBuild.slice(prereleaseSeparatorIndex + 1);
  if (!corePart) {
    return null;
  }
  const coreIdentifiers = corePart.split('.').map(Number);
  if (coreIdentifiers.length !== 3) {
    return null;
  }

  return {
    core: [coreIdentifiers[0] ?? 0, coreIdentifiers[1] ?? 0, coreIdentifiers[2] ?? 0],
    prerelease: prereleasePart ? prereleasePart.split('.') : null,
  };
}

function comparePrerelease(
  current: readonly string[] | null,
  minimum: readonly string[] | null,
): number {
  if (current === null && minimum === null) {
    return 0;
  }
  if (current === null) {
    return 1;
  }
  if (minimum === null) {
    return -1;
  }

  const length = Math.max(current.length, minimum.length);
  for (let index = 0; index < length; index += 1) {
    const currentIdentifier = current[index];
    const minimumIdentifier = minimum[index];

    if (currentIdentifier === undefined) {
      return -1;
    }
    if (minimumIdentifier === undefined) {
      return 1;
    }
    if (currentIdentifier === minimumIdentifier) {
      continue;
    }

    const currentIsNumeric = /^\d+$/.test(currentIdentifier);
    const minimumIsNumeric = /^\d+$/.test(minimumIdentifier);
    if (currentIsNumeric && minimumIsNumeric) {
      return Number(currentIdentifier) - Number(minimumIdentifier);
    }
    if (currentIsNumeric) {
      return -1;
    }
    if (minimumIsNumeric) {
      return 1;
    }
    return currentIdentifier < minimumIdentifier ? -1 : 1;
  }

  return 0;
}

export function isSemanticVersionAtLeast(
  appVersion: string | undefined,
  minVersion: string,
): boolean {
  const current = parseSemanticVersion(appVersion);
  const minimum = parseSemanticVersion(minVersion);
  if (!current || !minimum) {
    return false;
  }

  for (let index = 0; index < current.core.length; index += 1) {
    const difference = (current.core[index] ?? 0) - (minimum.core[index] ?? 0);
    if (difference !== 0) {
      return difference > 0;
    }
  }

  return comparePrerelease(current.prerelease, minimum.prerelease) >= 0;
}

const canAutoOpen = ({
  authStatus,
  config,
  user,
  appVersion,
  hasBundledCampaign,
  hasSeen,
}: FeatureDiscoveryEligibility): boolean => {
  if (authStatus !== 'authenticated' || !config?.enabled || !user) {
    return false;
  }

  return (
    config.autoOpen &&
    hasBundledCampaign &&
    !hasSeen &&
    user.createdAt.getTime() < config.launchedAt.getTime() &&
    isSemanticVersionAtLeast(appVersion, config.minAppVersion)
  );
};

export const FeatureDiscoveryPolicy = {
  canAutoOpen,
} as const;
