const fs = require('node:fs');
const path = require('node:path');
const { withUniwindConfig } = require('uniwind/metro');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const workspaceRoot = path.resolve(__dirname, '../..');
const projectRootFromWorkspace = path.relative(workspaceRoot, __dirname).replace(/\\/g, '/');

const config = getSentryExpoConfig(__dirname);

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

const uniwindConfig = withUniwindConfig(config, {
  cssEntryFile: './global.css',
});

const uniwindResolveRequest = uniwindConfig.resolver.resolveRequest;

// Expo resolves the first bundle entry from the workspace root in monorepos.
// Resolve that request before Uniwind's resolver reaches Metro's package-export lookup.
function resolveWorkspaceEntryRequest(context, moduleName) {
  const originModulePath = path.normalize(context.originModulePath);
  const isWorkspaceRootRequest = originModulePath === workspaceRoot;
  const isProjectEntryRequest = moduleName.startsWith(`./${projectRootFromWorkspace}/`);

  if (!isWorkspaceRootRequest || !isProjectEntryRequest) {
    return null;
  }

  const requestPath = path.resolve(workspaceRoot, moduleName);
  const sourceExts = context.sourceExts ?? uniwindConfig.resolver.sourceExts ?? [];
  const candidates = [
    requestPath,
    ...sourceExts.map((extension) => `${requestPath}.${extension}`),
    ...sourceExts.map((extension) => path.join(requestPath, `index.${extension}`)),
  ];

  const filePath = candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );

  return filePath ? { type: 'sourceFile', filePath } : null;
}

uniwindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  const workspaceEntryResolution = resolveWorkspaceEntryRequest(context, moduleName);

  if (workspaceEntryResolution) {
    return workspaceEntryResolution;
  }

  return uniwindResolveRequest(context, moduleName, platform);
};

module.exports = uniwindConfig;
