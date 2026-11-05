const { withInfoPlist } = require('expo/config-plugins');

const DEV_LAUNCHER_BONJOUR_SERVICE = '_expo._tcp';
const DEV_LAUNCHER_DESCRIPTION_MARKER = 'Expo Dev Launcher';

/**
 * expo-dev-launcher adds local network keys to every build and strips them from Release in a
 * build phase. On a clean build that phase runs before Xcode writes Info.plist, so it finds no
 * file and the English dev-launcher purpose string ships (seen in the 1.10.0 IPA and a 1.15.0
 * Release build, expo-dev-launcher 58.0.18). Only the dev launcher uses these keys, and it is
 * not part of Release, so builds without it drop them during prebuild.
 */
function removeDevLauncherLocalNetworkKeys(infoPlist) {
  const { NSBonjourServices, NSLocalNetworkUsageDescription, ...rest } = infoPlist;
  const bonjourServices = (NSBonjourServices ?? []).filter(
    (service) => service !== DEV_LAUNCHER_BONJOUR_SERVICE,
  );

  return {
    ...rest,
    ...(bonjourServices.length > 0 && { NSBonjourServices: bonjourServices }),
    ...(NSLocalNetworkUsageDescription != null &&
      !NSLocalNetworkUsageDescription.includes(DEV_LAUNCHER_DESCRIPTION_MARKER) && {
        NSLocalNetworkUsageDescription,
      }),
  };
}

const withoutDevLauncherLocalNetwork = (config) =>
  withInfoPlist(config, (config) => {
    config.modResults = removeDevLauncherLocalNetworkKeys(config.modResults);
    return config;
  });

module.exports = withoutDevLauncherLocalNetwork;
module.exports.removeDevLauncherLocalNetworkKeys = removeDevLauncherLocalNetworkKeys;
