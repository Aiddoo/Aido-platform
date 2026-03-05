const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

// SVG transformer 설정
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

// Block test-only files from production bundle
config.resolver.blockList = [
  ...(config.resolver.blockList ?? []),
  /.*\.test\.[jt]sx?$/,
  /.*\.spec\.[jt]sx?$/,
];

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
});
