const { withDangerousMod } = require('expo/config-plugins');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

module.exports = (config) =>
  withDangerousMod(config, [
    'android',
    async (androidConfig) => {
      const svg = await readFile(
        join(androidConfig.modRequest.projectRoot, 'assets/icons/ic_paw.svg'),
        'utf8',
      );
      const pathData = svg.match(/<path\s+d="([^"]+)"/)?.[1];
      if (!pathData) {
        throw new Error('Widget paw asset is missing its SVG path');
      }

      const drawableDirectory = join(
        androidConfig.modRequest.platformProjectRoot,
        'app/src/main/res/drawable',
      );
      const pawPath = `<path android:fillColor="#FFFFFFFF" android:pathData="${pathData}" />`;
      const drawable = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="24dp" android:height="20dp"
  android:viewportWidth="24" android:viewportHeight="20">
  <group android:scaleX="0.6" android:scaleY="0.6" android:translateY="0.5">
    ${pawPath}
  </group>
  <group android:scaleX="0.6" android:scaleY="0.6" android:translateX="11.5" android:translateY="7.5">
    ${pawPath}
  </group>
</vector>
`;

      await mkdir(drawableDirectory, { recursive: true });
      await writeFile(join(drawableDirectory, 'aido_widget_paw.xml'), drawable);
      return androidConfig;
    },
  ]);
