const { AndroidConfig, withAppBuildGradle, withFinalizedMod } = require('expo/config-plugins');
const { mkdir, readFile, unlink, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const WIDGETS = ['AidoTodaySummary', 'AidoTodayList', 'AidoTodayLarge'];
const MMKV_DEPENDENCY = 'implementation "io.github.zhongwuzw:mmkv:2.4.1"';

module.exports = (config) => {
  config = withAppBuildGradle(config, (androidConfig) => {
    const contents = androidConfig.modResults.contents;
    if (!contents.includes(MMKV_DEPENDENCY)) {
      if (!/dependencies\s*\{/.test(contents))
        throw new Error('Android dependencies block missing');
      androidConfig.modResults.contents = contents.replace(
        /dependencies\s*\{/,
        (block) => `${block}\n    ${MMKV_DEPENDENCY}`,
      );
    }
    return androidConfig;
  });

  return withFinalizedMod(config, [
    'android',
    async (androidConfig) => {
      const projectRoot = androidConfig.modRequest.platformProjectRoot;
      const androidPackage = AndroidConfig.Package.getPackage(androidConfig);
      if (!androidPackage) throw new Error('Android package missing for widget compatibility');
      const manifestPath = join(projectRoot, 'app/src/main/AndroidManifest.xml');
      const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
      const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
      application.receiver = (application.receiver ?? []).filter((receiver) => {
        const component = receiver.$['android:name'];
        const isLegacy = WIDGETS.some(
          (name) =>
            component === `${androidPackage}.widget.${name}` || component === `.widget.${name}`,
        );
        return (
          !isLegacy ||
          receiver['meta-data']?.some(
            (metadata) => metadata.$['android:name'] === 'expo.modules.widgets.NAME',
          )
        );
      });
      application.service = (application.service ?? []).filter(
        (service) =>
          service.$['android:name'] !== 'com.reactnativeandroidwidget.RNWidgetCollectionService',
      );
      const widgetDirectory = join(
        projectRoot,
        'app/src/main/java',
        ...androidPackage.split('.'),
        'widget',
      );
      await mkdir(widgetDirectory, { recursive: true });

      for (const name of WIDGETS) {
        const receiver = application.receiver?.find((item) =>
          item['meta-data']?.some(
            (metadata) =>
              metadata.$['android:name'] === 'expo.modules.widgets.NAME' &&
              metadata.$['android:value'] === name,
          ),
        );
        if (!receiver) throw new Error(`Expo widget receiver missing for ${name}`);
        receiver.$['android:name'] = `${androidPackage}.widget.${name}`;
        receiver.$['android:exported'] = 'false';
        const actions = receiver['intent-filter'][0].action;
        const legacyClick = `${androidPackage}.WIDGET_CLICK`;
        if (!actions.some((action) => action.$['android:name'] === legacyClick)) {
          actions.push({ $: { 'android:name': legacyClick } });
        }
        const legacySourcePath = join(widgetDirectory, `${name}.java`);
        const legacySource = await readFile(legacySourcePath, 'utf8').catch((error) => {
          if (error.code === 'ENOENT') return null;
          throw error;
        });
        if (legacySource != null) {
          if (!legacySource.includes('extends RNWidgetProvider'))
            throw new Error(`Unexpected existing widget source: ${name}.java`);
          await unlink(legacySourcePath);
        }
        await writeFile(
          join(widgetDirectory, `${name}.kt`),
          `package ${androidPackage}.widget\n\nclass ${name} : AidoWidgetCompatibilityProvider("${name}")\n`,
        );
      }

      for (const template of [
        'AidoWidgetCompatibilityProvider.kt',
        'LegacyWidgetSnapshotMigration.kt',
      ]) {
        const source = await readFile(join(__dirname, 'android', template), 'utf8');
        await writeFile(
          join(widgetDirectory, template),
          source.replaceAll('__ANDROID_PACKAGE__', androidPackage),
        );
      }
      await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, manifest);
      return androidConfig;
    },
  ]);
};
