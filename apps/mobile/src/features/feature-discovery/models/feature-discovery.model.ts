import { featureDiscoveryMinAppVersionSchema } from '@aido/validators';
import type { User } from '@src/features/user/models/user.model';

export type FeatureDiscoveryConfig =
  | { enabled: false }
  | {
      enabled: true;
      campaignId: string;
      minAppVersion: string;
      launchedAt: Date;
      autoOpen: boolean;
    };

type AuthStatus = 'loading' | 'locked' | 'authenticated' | 'unauthenticated';

interface FeatureDiscoveryEligibility {
  authStatus: AuthStatus;
  config: FeatureDiscoveryConfig | undefined;
  user: Pick<User, 'createdAt'> | undefined;
  appVersion: string | undefined;
  hasBundledCampaign: boolean;
  hasSeen: boolean;
}

interface ParsedSemanticVersion {
  core: readonly [number, number, number];
  prerelease: readonly string[] | null;
}

function parseSemanticVersion(value: string | undefined): ParsedSemanticVersion | null {
  if (!value || !featureDiscoveryMinAppVersionSchema.safeParse(value).success) {
    return null;
  }

  const withoutBuild = value.split('+', 1)[0];
  if (!withoutBuild) {
    return null;
  }

  const [corePart, prereleasePart] = withoutBuild.split('-', 2);
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
    return currentIdentifier.localeCompare(minimumIdentifier);
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
