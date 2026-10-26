import fs from 'node:fs';
import path from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';
import { match } from 'ts-pattern';

import enNativeLocale from './native-locales/en.json';
import koNativeLocale from './native-locales/ko.json';
import { version } from './package.json';

type AppEnvironment = 'development' | 'preview' | 'production';

interface EnvironmentConfig {
  name: string;
  bundleIdentifier: string;
  packageName: string;
  scheme: string;
  apiUrl: string;
}

const PROJECT_SLUG = 'aido';
const OWNER = 'aido-team';
const VERSION = version;

const APP_NAME = 'Aido';
const BUNDLE_IDENTIFIER = 'com.aido.mobile';
const PACKAGE_NAME = 'com.aido.mobile';
const SCHEME = 'aido';

// 홈 화면 앱 이름 (iOS CFBundleDisplayName, Android app_name). 권한 안내 문구는 native-locales/*.json 한 벌을 모든 환경이 공유한다.
const DISPLAY_NAMES: Record<AppEnvironment, { ko: string; en: string }> = {
  production: { ko: '아이두', en: 'Aido' },
  preview: { ko: '아이두 Preview', en: 'Aido Preview' },
  development: { ko: '아이두 Dev', en: 'Aido Development' },
};

const BRAND_COLOR = '#FF6B43';

// 초대 링크 https://aido.kr/i/{inviteCode} (AASA·assetlinks는 랜딩이 /i/* 만 연다)
const INVITE_LINK_HOST = 'aido.kr';
const INVITE_LINK_PATH_PREFIX = '/i/';

// 카카오 Android SDK는 Maven Central이 아닌 카카오 저장소에 있다
const KAKAO_MAVEN_REPOSITORY = 'https://devrepo.kakao.com/nexus/content/groups/public/';
// 카카오톡 공유가 카카오톡 설치 여부를 확인할 때 쓰는 스킴
const KAKAO_QUERY_SCHEMES = ['kakaokompassauth', 'kakaolink', 'kakaoplus'];

// Assets
const ICON = './assets/images/icon.png';
const ADAPTIVE_ICON = './assets/images/adaptive-icon.png';
const SPLASH = './assets/images/splash-icon.png';
const SPLASH_ANDROID = './assets/images/splash-icon-android.png';
const NOTIFICATION_ICON = './assets/images/notification-icon.png';

// Environment

const PROJECT_ROOT = __dirname;
// A relative plugin path avoids EAS runtime fallback and location-dependent fingerprints.
const WEB_BROWSER_PLUGIN_PATH = path.relative(
  PROJECT_ROOT,
  path.join(path.dirname(require.resolve('expo-web-browser/package.json')), 'app.plugin.js'),
);

const restoreBase64File = ({
  envVar,
  outputPath,
  label,
}: {
  envVar: string | undefined;
  outputPath: string;
  label: string;
}) => {
  if (!envVar) {
    console.warn(`[eas] ${label} env var not set; skipping restore.`);
    return;
  }

  if (fs.existsSync(outputPath)) {
    return;
  }

  try {
    const cleaned = envVar.replace(/\s+/g, '');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(cleaned, 'base64'));
    console.log(`[eas] Restored ${label} to ${path.relative(PROJECT_ROOT, outputPath)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[eas] Failed to restore ${label}: ${message}`);
  }
};

const getEnvironmentConfig = (environment: AppEnvironment): EnvironmentConfig => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  return (
    match(environment)
      .with('production', () => ({
        name: APP_NAME,
        bundleIdentifier: BUNDLE_IDENTIFIER,
        packageName: PACKAGE_NAME,
        scheme: SCHEME,
        apiUrl: apiUrl ?? 'https://api.aido.kr',
      }))
      .with('preview', () => ({
        name: `${APP_NAME} Preview`,
        bundleIdentifier: `${BUNDLE_IDENTIFIER}.preview`,
        packageName: `${PACKAGE_NAME}.preview`,
        scheme: `${SCHEME}-preview`,
        apiUrl: apiUrl ?? 'https://api.aido.kr',
      }))
      // TODO: google-services.json에 .dev 패키지 추가 후 suffix 복원 (`${BUNDLE_IDENTIFIER}.dev`, `${PACKAGE_NAME}.dev`)
      .with('development', () => ({
        name: `${APP_NAME} Development`,
        bundleIdentifier: BUNDLE_IDENTIFIER,
        packageName: PACKAGE_NAME,
        scheme: `${SCHEME}-dev`,
        apiUrl: apiUrl ?? 'http://localhost:8080',
      }))
      .exhaustive()
  );
};

const resolveEnvironment = (rawEnv: string): AppEnvironment =>
  match(rawEnv)
    .with('production', () => 'production' as const)
    .with('preview', () => 'preview' as const)
    .otherwise(() => 'development' as const);

export default ({ config }: ConfigContext): ExpoConfig => {
  const rawEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
  const env = resolveEnvironment(rawEnv);
  const isDevelopment = env === 'development';
  const isProduction = env === 'production';

  const configuredProjectId: unknown = config.extra?.eas?.projectId;
  const EAS_PROJECT_ID =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    (typeof configuredProjectId === 'string' ? configuredProjectId : undefined);

  restoreBase64File({
    envVar: process.env.GOOGLE_SERVICES_JSON,
    outputPath: path.resolve(PROJECT_ROOT, 'google-services.json'),
    label: 'google-services.json',
  });

  restoreBase64File({
    envVar: process.env.GOOGLE_SERVICES_INFO_PLIST,
    outputPath: path.resolve(PROJECT_ROOT, 'GoogleService-Info.plist'),
    label: 'GoogleService-Info.plist',
  });

  const envConfig = getEnvironmentConfig(env);
  // 키가 없는 로컬 빌드는 카카오 공유 없이(OS 공유로) 동작한다
  const kakaoNativeAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;

  // 홈 위젯 데이터 공유용 App Group — 번들 id를 따라 환경별로 분리된다
  // (development는 프로덕션 번들 id를 공유 중이므로 그룹도 공유 — 라인 87 TODO 복원 시 함께 분리됨)
  const appGroupIdentifier = `group.${envConfig.bundleIdentifier}`;

  return {
    ...config,

    // Basic Info
    name: envConfig.name,
    slug: PROJECT_SLUG,
    owner: OWNER,
    version: VERSION,
    scheme: envConfig.scheme,
    orientation: 'portrait',

    // Branding
    icon: ICON,
    userInterfaceStyle: 'automatic',

    // 홈 화면 앱 이름(iOS CFBundleDisplayName, Android app_name), iOS 권한 다이얼로그 문구(InfoPlist.strings)와 위젯 갤러리 이름·설명 다국어
    locales: {
      ko: {
        ios: { CFBundleDisplayName: DISPLAY_NAMES[env].ko, ...koNativeLocale.ios },
        android: { app_name: DISPLAY_NAMES[env].ko, ...koNativeLocale.android },
      },
      en: {
        ios: { CFBundleDisplayName: DISPLAY_NAMES[env].en, ...enNativeLocale.ios },
        android: { app_name: DISPLAY_NAMES[env].en, ...enNativeLocale.android },
      },
    },

    // iOS
    ios: {
      appStoreUrl: 'https://apps.apple.com/app/id6757722325',
      supportsTablet: true,
      bundleIdentifier: envConfig.bundleIdentifier,
      usesAppleSignIn: true,
      // 운영 앱만 aido.kr AASA에 등록돼 있다
      ...(isProduction && { associatedDomains: [`applinks:${INVITE_LINK_HOST}`] }),
      googleServicesFile: './GoogleService-Info.plist',
      config: {
        // false: HTTPS만 사용, 커스텀 암호화 없음 (App Store 제출 시 수출 규정 질문 스킵)
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        UIViewControllerBasedStatusBarAppearance: true,
        ...(kakaoNativeAppKey && { LSApplicationQueriesSchemes: KAKAO_QUERY_SCHEMES }),
        CFBundleAllowMixedLocalizations: true,
        // CFBundleLocalizations는 expo-localization 플러그인(supportedLocales)이 설정
        // 언어별 문구는 native-locales/{ko,en}.json이 덮어쓴다. 기본값은 ko와 같게 둔다.
        NSMicrophoneUsageDescription: '말로 할 일을 입력할 때 마이크를 써요.',
        NSSpeechRecognitionUsageDescription:
          '말한 내용을 글자로 바꿔 할 일을 입력할 때 써요. 음성은 Apple 음성 인식으로 처리될 수 있어요.',
        // 앱이 사진을 직접 읽지 않아도 포함된 SDK가 사진 보관함 API를 참조해 App Store 업로드에 읽기 문구가 필요하다(ITMS-90683).
        NSPhotoLibraryUsageDescription: '공유하거나 저장할 이미지를 다룰 때 사진 보관함을 써요.',
        // 공유 시트의 "이미지 저장"이 사진 보관함에 추가할 때 쓴다.
        NSPhotoLibraryAddUsageDescription: '공유한 이미지를 사진 보관함에 저장할 때 써요.',
        ...(isDevelopment && {
          NSAppTransportSecurity: {
            NSAllowsArbitraryLoads: true,
            NSExceptionDomains: {
              localhost: {
                NSExceptionAllowsInsecureHTTPLoads: true,
                NSIncludesSubdomains: true,
              },
            },
          },
        }),
      },
      entitlements: {
        'aps-environment': isProduction ? 'production' : 'development',
        // 홈 위젯(expo-widgets)과 스냅샷 공유 — 위젯 확장 타깃의 그룹은 플러그인이 설정
        'com.apple.security.application-groups': [appGroupIdentifier],
      },
    },

    // Android
    android: {
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.aido.mobile',
      package: envConfig.packageName,
      adaptiveIcon: {
        foregroundImage: ADAPTIVE_ICON,
        backgroundColor: BRAND_COLOR,
      },
      intentFilters: [
        {
          action: 'VIEW',
          data: [
            { scheme: envConfig.scheme, host: 'auth', pathPrefix: '/kakao' },
            { scheme: envConfig.scheme, host: 'auth', pathPrefix: '/naver' },
            { scheme: envConfig.scheme, host: 'auth', pathPrefix: '/google' },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
        // 초대 링크 App Links. OAuth 콜백 필터와 분리해 기존 auth 경로는 그대로 둔다
        ...(isProduction
          ? [
              {
                action: 'VIEW',
                autoVerify: true,
                data: [
                  { scheme: 'https', host: INVITE_LINK_HOST, pathPrefix: INVITE_LINK_PATH_PREFIX },
                ],
                category: ['BROWSABLE', 'DEFAULT'],
              },
            ]
          : []),
      ],
      permissions: ['RECORD_AUDIO', 'VIBRATE', 'RECEIVE_BOOT_COMPLETED', 'POST_NOTIFICATIONS'],
      // 광고 SDK가 없어 광고 ID를 쓰지 않는다. Firebase Analytics(play-services-measurement-api)가
      // 병합하는 광고 ID 권한을 빼서 Play Console 광고 ID 신고를 "아니요"로 유지한다.
      blockedPermissions: [
        'com.google.android.gms.permission.AD_ID',
        'android.permission.ACCESS_ADSERVICES_AD_ID',
        'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
      ],
      googleServicesFile: './google-services.json',
    },

    // Web
    web: {
      bundler: 'metro',
      output: 'static',
    },

    // Plugins
    plugins: [
      './plugins/withJitpackFilter',
      './plugins/withGradleJvmArgs',
      // @react-native-kakao 모듈의 compileSdk 33을 앱 compileSdk로 맞춘다 (release AAR metadata 검사)
      './plugins/withKakaoAndroidCompileSdk',
      [
        'expo-localization',
        {
          // iOS CFBundleLocalizations + Android locales_config.xml(13+ 앱별 언어) 생성
          supportedLocales: ['ko', 'en'],
          // 시스템 언어 변경 시 액티비티 재시작 없이 JS(i18n)가 처리
          allowDynamicLocaleChangesAndroid: true,
        },
      ],
      [
        '@react-native-firebase/app',
        {
          ios: {
            disableSPM: true,
          },
        },
      ],
      './plugins/withFirebaseInitialization',
      '@react-native-community/datetimepicker',
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          organization: 'redband',
          project: 'aido-mobile-production',
        },
      ],
      [
        'expo-build-properties',
        {
          ios: {
            // 1.10.0: precompiled ExpoFileSystem referenced a missing ExpoModulesJSI Swift symbol.
            // Compile Expo modules together until their precompiled ABI is compatible.
            usePrecompiledModules: false,
            useFrameworks: 'static',
            forceStaticLinking: ['RNFBApp', 'RNFBAnalytics'],
          },
          android: {
            // WorkManager restores mergers by reflection, including work saved before an update.
            extraProguardRules:
              '-keep class * extends androidx.work.InputMerger { public <init>(); }',
            ...(isDevelopment && { usesCleartextTraffic: true }),
            extraMavenRepos: [KAKAO_MAVEN_REPOSITORY],
          },
        },
      ],
      ...(kakaoNativeAppKey
        ? [
            [
              '@react-native-kakao/core',
              {
                nativeAppKey: kakaoNativeAppKey,
                // 카카오톡 공유 메시지 버튼(kakao{KEY}://kakaolink)이 앱을 열게 한다
                android: { forwardKakaoLinkIntentFilterToMainActivity: true },
                ios: {},
              },
            ] satisfies [string, Record<string, unknown>],
          ]
        : []),

      'expo-router',

      [
        'expo-splash-screen',
        {
          ios: {
            image: SPLASH,
            resizeMode: 'contain',
            backgroundColor: BRAND_COLOR,
            // SDK 57: 플러그인 기본은 100pt 로고 모드 — 기존 전체 화면 스플래시 유지
            enableFullScreenImage_legacy: true,
          },
          android: {
            image: SPLASH_ANDROID,
            imageWidth: 288,
            resizeMode: 'contain',
            backgroundColor: BRAND_COLOR,
          },
        },
      ],

      [
        'expo-font',
        {
          fonts: [
            './assets/fonts/WantedSans-Regular.ttf',
            './assets/fonts/WantedSans-Medium.ttf',
            './assets/fonts/WantedSans-SemiBold.ttf',
            './assets/fonts/WantedSans-Bold.ttf',
          ],
        },
      ],

      [
        'expo-notifications',
        {
          icon: NOTIFICATION_ICON,
          color: BRAND_COLOR,
          // TODO: 알림음 파일 추가 시 설정
          // sounds: ["./assets/sounds/notification.wav"],
        },
      ],

      [
        'expo-location',
        {
          // 언어별 문구는 native-locales/{ko,en}.json이 덮어쓴다. 기본값은 ko와 같게 둔다.
          locationWhenInUsePermission: '현재 위치의 날씨를 보여줄 때 위치를 써요.',
          // 날씨는 대략적인 위치(Balanced)만 쓰므로 정확한 위치 임시 요청과 동작 감지 권한을 넣지 않는다.
          locationFullAccuracyPermission: false,
          motionUsagePermission: false,
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false,
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
        },
      ],

      'expo-secure-store',
      'expo-sharing',
      'expo-system-ui',
      WEB_BROWSER_PLUGIN_PATH,

      [
        'expo-speech-recognition',
        {
          // 언어별 문구는 native-locales/{ko,en}.json이 덮어쓴다. 기본값은 ko와 같게 둔다.
          microphonePermission: '말로 할 일을 입력할 때 마이크를 써요.',
          speechRecognitionPermission:
            '말한 내용을 글자로 바꿔 할 일을 입력할 때 써요. 음성은 Apple 음성 인식으로 처리될 수 있어요.',
          androidSpeechServicePackages: [
            'com.google.android.googlequicksearchbox',
            'com.google.android.tts',
          ],
        },
      ],
      [
        'expo-quick-actions/icon/plugin',
        {
          scottish_fold: { image: './assets/premium-app-icons/scottish-fold.png' },
          orange_tabby: { image: './assets/premium-app-icons/orange-tabby.png' },
          black_cat: { image: './assets/premium-app-icons/black-cat.png' },
          white_cat: { image: './assets/premium-app-icons/white-cat.png' },
          siamese: { image: './assets/premium-app-icons/siamese.png' },
          russian_blue: { image: './assets/premium-app-icons/russian-blue.png' },
          cream_cat: { image: './assets/premium-app-icons/cream-cat.png' },
          tuxedo_cat: { image: './assets/premium-app-icons/tuxedo-cat.png' },
        },
      ],

      [
        'expo-widgets',
        {
          bundleIdentifier: `${envConfig.bundleIdentifier}.ExpoWidgetsTarget`,
          groupIdentifier: appGroupIdentifier,
          // displayName·description은 위젯 확장의 Localizable.strings 키다.
          // 번역은 native-locales/{ko,en}.json의 ios["Localizable.strings"]에 둔다.
          widgets: [
            {
              name: 'AidoTodayList',
              displayName: '오늘 할 일',
              description: '오늘의 할 일과 체크 여부를 홈 화면에서 바로 확인해요',
              ios: {
                initialLayout: './src/features/widget/components/widgets.ios.tsx',
                supportedFamilies: ['systemSmall', 'systemMedium', 'systemLarge'],
              },
            },
          ],
        },
      ],
      [
        'react-native-android-widget',
        {
          // label·description 문자열은 native-locales/{ko,en}.json의 android 항목이다.
          // description 값은 values/의 기본값이 아래 fallback 플러그인(en)으로 교체된다.
          widgets: [
            {
              name: 'AidoTodaySummary',
              label: '@string/widget_aidotodaysummary_label',
              description: '오늘 할 일 진행률과 연속 달성 기록을 한눈에 확인해요',
              minWidth: '110dp',
              minHeight: '110dp',
              targetCellWidth: 2,
              targetCellHeight: 2,
              resizeMode: 'none',
              updatePeriodMillis: 1800000,
            },
            {
              name: 'AidoTodayList',
              label: '@string/widget_aidotodaylist_label',
              description: '오늘의 할 일과 체크 여부를 홈 화면에서 바로 확인해요',
              minWidth: '250dp',
              minHeight: '110dp',
              targetCellWidth: 4,
              targetCellHeight: 2,
              resizeMode: 'none',
              updatePeriodMillis: 1800000,
            },
            {
              name: 'AidoTodayLarge',
              label: '@string/widget_aidotodaylarge_label',
              description: '한 주의 발자국과 오늘 할 일을 확인하고 바로 만들어요',
              minWidth: '250dp',
              minHeight: '250dp',
              targetCellWidth: 4,
              targetCellHeight: 4,
              resizeMode: 'none',
              updatePeriodMillis: 1800000,
            },
          ],
        },
      ],
      // 기기 언어가 ko·en이 아니어도 위젯 이름을 찾도록 en 문자열을 Android 기본 values/에 둔다
      ['./plugins/withAndroidFallbackLocaleStrings', { locale: 'en' }],
    ],

    // Experiments
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },

    // EAS Updates
    ...(EAS_PROJECT_ID && {
      updates: {
        url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
      },
    }),
    runtimeVersion: {
      policy: 'fingerprint',
    },

    // Extra (Constants.expoConfig.extra)
    extra: {
      ...config.extra,
      env,
      apiUrl: envConfig.apiUrl,
      devMachineIp: process.env.EXPO_PUBLIC_DEV_MACHINE_IP,
      isDevelopment,
      isProduction,
      revenueCatAppleApiKey: process.env.REVENUECAT_APPLE_API_KEY,
      revenueCatGoogleApiKey: process.env.REVENUECAT_GOOGLE_API_KEY,
      revenueCatTestApiKey: process.env.REVENUECAT_TEST_API_KEY,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      kakaoNativeAppKey,
      // dev에서 Sentry 전송을 강제로 켜는 플래그(테스트 버튼 검증용). 평소 미설정 → dev는 전송 안 함.
      sentryDebug: process.env.EXPO_PUBLIC_SENTRY_DEBUG === 'true',
    },
  };
};
