const fs = require('node:fs/promises');
const path = require('node:path');
const { AndroidConfig, XML, withFinalizedMod } = require('expo/config-plugins');

/**
 * Expo `locales` writes Android strings only to `values-b+{lang}/`. Strings referenced from
 * the manifest or widget provider XML also need a default `values/` entry, otherwise a device
 * whose language matches no locale cannot resolve them.
 *
 * Copy the fallback locale's `android` section into `values/strings.xml`. It runs as a
 * finalized mod so it replaces the untranslatable copies that other plugins (for example
 * react-native-android-widget's `widget_*_description`) wrote, whatever the plugin order.
 */
async function readLocale(projectRoot, locale) {
  if (typeof locale !== 'string') {
    return locale;
  }
  return JSON.parse(await fs.readFile(path.join(projectRoot, locale), 'utf8'));
}

const withAndroidFallbackLocaleStrings = (config, { locale }) =>
  withFinalizedMod(config, [
    'android',
    async (config) => {
      const source = config.locales?.[locale];
      if (source == null) {
        throw new Error(`[withAndroidFallbackLocaleStrings] Missing locales.${locale}.`);
      }
      const { projectRoot } = config.modRequest;
      const strings = (await readLocale(projectRoot, source)).android ?? {};
      const stringsPath = await AndroidConfig.Strings.getProjectStringsXMLPathAsync(projectRoot);
      const stringsXml = await XML.readXMLAsync({ path: stringsPath });
      const items = Object.entries(strings).map(([name, value]) => ({
        $: { name },
        // writeXMLAsync escapes Android quotes and apostrophes for res/values/strings.xml.
        _: value,
      }));
      await XML.writeXMLAsync({
        path: stringsPath,
        xml: AndroidConfig.Strings.setStringItem(items, stringsXml),
      });
      return config;
    },
  ]);

module.exports = withAndroidFallbackLocaleStrings;
