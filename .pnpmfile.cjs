module.exports = {
  hooks: {
    readPackage(pkg) {
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
