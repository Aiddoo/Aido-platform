const path = require('node:path');
const reanimatedResolver = require('react-native-reanimated/jest/resolver');
const reactNativeResolver = require(require('@react-native/jest-preset').resolver);

module.exports = (request, options) => {
  const packages = ['react-native-reanimated', 'react-native-worklets'];
  const owner = packages.find(
    (name) =>
      options.basedir.includes(`/node_modules/${name}/`) ||
      options.basedir.endsWith(`/node_modules/${name}`),
  );
  if (!owner && !request.startsWith('react-native-worklets'))
    return reactNativeResolver(request, options);

  // pnpm peer suffixes must not make other packages look like Worklets to its resolver.
  const packageMarker = `/node_modules/${owner}`;
  const suffix = owner
    ? options.basedir.slice(options.basedir.lastIndexOf(packageMarker) + packageMarker.length)
    : '';
  return reanimatedResolver(request, {
    ...options,
    basedir: owner ? path.join(__dirname, 'node_modules', owner, suffix) : options.basedir,
    defaultResolver: (modulePath, nextOptions) =>
      reactNativeResolver(modulePath, { ...nextOptions, defaultResolver: options.defaultResolver }),
  });
};
