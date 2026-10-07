module.exports = {
  hooks: {
    readPackage(pkg) {
      if (
        (pkg.name === 'alchemy' && pkg.version === '2.0.0-beta.78') ||
        (pkg.name === '@effect/vitest' && ['4.0.1', '4.0.0-rc.115'].includes(pkg.version))
      ) {
        // Composer's test integrations are unused by local contract/migration commands.
        // Keep version validation when Vitest is present, without requiring it in production.
        pkg.peerDependenciesMeta = { ...pkg.peerDependenciesMeta, vitest: { optional: true } };
      }
      if (pkg.name === 'heroui-native' && pkg.version === '1.0.10') {
        // Paired with the versioned GH 3 compatibility patch and native validation.
        pkg.peerDependencies['react-native-gesture-handler'] = '~3.2.1';
      }
      if (pkg.name === 'expo-modules-core' && pkg.version === '58.0.10') {
        // SDK 58 bundles Worklets 0.13; this package still lists the previous cohort.
        pkg.peerDependencies['react-native-worklets'] += ' || ^0.13.0';
      }
      return pkg;
    },
  },
};
