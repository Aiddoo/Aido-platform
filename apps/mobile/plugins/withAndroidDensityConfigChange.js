const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const DENSITY = 'density';

/**
 * 폴더블은 바깥·안쪽 화면의 밀도가 다를 수 있다(Google은 가로형 폴더블·트라이폴드를 예로 든다).
 * MainActivity configChanges에 density가 없으면 그런 기기에서 접고 펼 때 Activity가 다시 만들어져
 * React 트리가 다시 마운트되고 보던 화면·스크롤·입력이 사라진다. 템플릿은 크기·방향 변경만 직접 받는다.
 * https://developer.android.com/develop/adaptive-apps/guides/foldables/trifolds-and-landscape-foldables
 */
function addDensityConfigChange(configChanges) {
  const changes = (configChanges ?? '').split('|').filter((change) => change !== '');

  return changes.includes(DENSITY) ? changes.join('|') : [...changes, DENSITY].join('|');
}

const withAndroidDensityConfigChange = (config) =>
  withAndroidManifest(config, (config) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    mainActivity.$['android:configChanges'] = addDensityConfigChange(
      mainActivity.$['android:configChanges'],
    );
    return config;
  });

module.exports = withAndroidDensityConfigChange;
module.exports.addDensityConfigChange = addDensityConfigChange;
