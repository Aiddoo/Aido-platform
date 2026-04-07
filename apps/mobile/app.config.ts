import fs from 'node:fs';
import path from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { match } from 'ts-pattern';

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
const VERSION = '1.3.0';

const APP_NAME = 'Aido';
const BUNDLE_IDENTIFIER = 'com.aido.mobile';
const PACKAGE_NAME = 'com.aido.mobile';
const SCHEME = 'aido';

const BRAND_COLOR = '#FF6B43';

// Assets
const ICON = './assets/images/icon.png';
const ADAPTIVE_ICON = './assets/images/adaptive-icon.png';
const SPLASH = './assets/images/splash-icon.png';
const SPLASH_ANDROID = './assets/images/splash-icon-android.png';
const FAVICON = './assets/images/favicon.png';
const NOTIFICATION_ICON = './assets/images/notification-icon.png';

// Environment

const PROJECT_ROOT = __dirname;

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

  const EAS_PROJECT_ID = (process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? config.extra?.eas?.projectId) as
    | string
    | undefined;

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

    // Splash
    splash: {
      image: SPLASH,
      resizeMode: 'contain',
      backgroundColor: BRAND_COLOR,
    },

    // iOS
    ios: {
      requireFullScreen: true,
      supportsTablet: true,
      bundleIdentifier: envConfig.bundleIdentifier,
      usesAppleSignIn: true,
      googleServicesFile: './GoogleService-Info.plist',
      config: {
        // false: HTTPS만 사용, 커스텀 암호화 없음 (App Store 제출 시 수출 규정 질문 스킵)
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        NSMicrophoneUsageDescription:
          '$(PRODUCT_NAME)이(가) 음성 입력을 위해 마이크에 접근하려고 합니다.',
        NSFaceIDUsageDescription:
          '$(PRODUCT_NAME)이(가) 앱 잠금 해제를 위해 Face ID를 사용하려고 합니다.',
        NSSpeechRecognitionUsageDescription:
          '$(PRODUCT_NAME)이(가) 음성 입력을 위해 음성 인식에 접근하려고 합니다.',
        NSPhotoLibraryUsageDescription:
          '$(PRODUCT_NAME)이(가) 이미지를 불러오기 위해 사진 라이브러리에 접근하려고 합니다.',
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
      },
    },

    // Android
    android: {
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
      ],
      permissions: [
        'RECORD_AUDIO',
        'VIBRATE',
        'RECEIVE_BOOT_COMPLETED',
        'USE_BIOMETRIC',
        'USE_FINGERPRINT',
        'POST_NOTIFICATIONS',
      ],
      googleServicesFile: './google-services.json',
    },

    // Web
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: FAVICON,
    },

    // Plugins
    plugins: [
      './plugins/withJitpackFilter',
      '@react-native-firebase/app',
      '@react-native-firebase/crashlytics',
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static',
            forceStaticLinking: ['RNFBApp', 'RNFBAnalytics', 'RNFBCrashlytics'],
          },
          android: {
            edgeToEdgeEnabled: true,
            ...(isDevelopment && { usesCleartextTraffic: true }),
          },
        },
      ],

      'expo-router',

      [
        'expo-splash-screen',
        {
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
        'expo-local-authentication',
        {
          faceIDPermission:
            // biome-ignore lint/suspicious/noTemplateCurlyInString: iOS/Android 빌드 시스템 플레이스홀더
            '${PRODUCT_NAME}이(가) 앱 잠금 해제를 위해 Face ID를 사용하려고 합니다.',
        },
      ],

      [
        'expo-location',
        {
          locationWhenInUsePermission:
            // biome-ignore lint/suspicious/noTemplateCurlyInString: iOS/Android 빌드 시스템 플레이스홀더
            '${PRODUCT_NAME}이(가) 현재 위치 기반 날씨 정보를 제공하기 위해 위치에 접근하려고 합니다.',
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false,
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
        },
      ],

      'expo-secure-store',
      'expo-sharing',
      'expo-system-ui',
      'expo-web-browser',

      [
        'expo-speech-recognition',
        {
          microphonePermission:
            // biome-ignore lint/suspicious/noTemplateCurlyInString: iOS/Android 빌드 시스템 플레이스홀더
            '${PRODUCT_NAME}이(가) 음성 입력을 위해 마이크에 접근하려고 합니다.',
          speechRecognitionPermission:
            // biome-ignore lint/suspicious/noTemplateCurlyInString: iOS/Android 빌드 시스템 플레이스홀더
            '${PRODUCT_NAME}이(가) 음성을 텍스트로 변환하기 위해 음성 인식에 접근하려고 합니다.',
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
        },
      ],
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
    },
  };
};
