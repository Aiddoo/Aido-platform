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

const EAS_PROJECT_ID = '185abed7-acd2-4d80-b652-cb3846e9806a';
const PROJECT_SLUG = 'aido';
const OWNER = 'aido-team';
const VERSION = '1.0.0';

const APP_NAME = 'Aido';
const BUNDLE_IDENTIFIER = 'com.aido.mobile';
const PACKAGE_NAME = 'com.aido.mobile';
const SCHEME = 'aido';

const BRAND_COLOR = '#FF6B43';

// =============================================================================
// Constants - Assets (images must exist in ./assets/images/)
// =============================================================================
const ICON = './assets/images/icon.png';
const ADAPTIVE_ICON = './assets/images/adaptive-icon.png';
const SPLASH = './assets/images/splash-icon.png';
const FAVICON = './assets/images/favicon.png';
// TODO: 알림 아이콘 추가 필요 (96x96, 흰색 투명 배경 PNG)
const _NOTIFICATION_ICON = './assets/images/notification-icon.png';

// =============================================================================
// Environment Configuration
// =============================================================================

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

  return match(environment)
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
      packageName: PACKAGE_NAME,
      scheme: `${SCHEME}-preview`,
      apiUrl: apiUrl ?? 'https://api.aido.kr',
    }))
    .with('development', () => ({
      name: `${APP_NAME} Development`,
      bundleIdentifier: `${BUNDLE_IDENTIFIER}.dev`,
      packageName: PACKAGE_NAME,
      scheme: `${SCHEME}-dev`,
      apiUrl: apiUrl ?? 'http://localhost:8080',
    }))
    .exhaustive();
};

const resolveEnvironment = (rawEnv: string): AppEnvironment =>
  match(rawEnv)
    .with('production', () => 'production' as const)
    .with('preview', () => 'preview' as const)
    .otherwise(() => 'development' as const);

// =============================================================================
// Main Configuration
// =============================================================================

export default ({ config }: ConfigContext): ExpoConfig => {
  // Resolve environment
  const rawEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
  const env = resolveEnvironment(rawEnv);
  const isDevelopment = env === 'development';
  const isProduction = env === 'production';

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

  // Get environment-specific config
  const envConfig = getEnvironmentConfig(env);

  return {
    ...config,

    // ==========================================================================
    // Basic Info
    // ==========================================================================

    name: envConfig.name,
    slug: PROJECT_SLUG,
    owner: OWNER,
    version: VERSION,
    scheme: envConfig.scheme,
    orientation: 'portrait',

    // ==========================================================================
    // Branding
    // ==========================================================================

    icon: ICON,
    userInterfaceStyle: 'automatic',

    // ==========================================================================
    // Notification (Push Notifications)
    // ==========================================================================

    notification: {
      // TODO: notification-icon.png 추가 후 주석 해제
      // icon: NOTIFICATION_ICON,
      color: BRAND_COLOR,
      iosDisplayInForeground: true,
      androidMode: 'default',
      androidCollapsedTitle: APP_NAME,
    },

    // ==========================================================================
    // Splash Screen
    // ==========================================================================

    splash: {
      image: SPLASH,
      resizeMode: 'contain',
      backgroundColor: BRAND_COLOR,
    },

    // ==========================================================================
    // iOS Configuration
    // ==========================================================================

    ios: {
      supportsTablet: true,
      bundleIdentifier: envConfig.bundleIdentifier,
      usesAppleSignIn: true,
      googleServicesFile: './GoogleService-Info.plist',
      config: {
        // false: HTTPS만 사용, 커스텀 암호화 없음 (App Store 제출 시 수출 규정 질문 스킵)
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        // 카메라 권한
        NSCameraUsageDescription:
          '$(PRODUCT_NAME)이(가) 사진 촬영을 위해 카메라에 접근하려고 합니다.',
        // 사진 라이브러리 권한
        NSPhotoLibraryUsageDescription:
          '$(PRODUCT_NAME)이(가) 사진 선택을 위해 사진 라이브러리에 접근하려고 합니다.',
        // 마이크 권한 (음성 입력)
        NSMicrophoneUsageDescription:
          '$(PRODUCT_NAME)이(가) 음성 입력을 위해 마이크에 접근하려고 합니다.',
        // 캘린더 권한
        NSCalendarsUsageDescription:
          '$(PRODUCT_NAME)이(가) 일정 동기화를 위해 캘린더에 접근하려고 합니다.',
        NSCalendarsWriteUsageDescription:
          '$(PRODUCT_NAME)이(가) 일정 추가를 위해 캘린더 쓰기 권한이 필요합니다.',
        // Face ID 권한
        NSFaceIDUsageDescription:
          '$(PRODUCT_NAME)이(가) 앱 잠금 해제를 위해 Face ID를 사용하려고 합니다.',
        // 음성 인식 권한
        NSSpeechRecognitionUsageDescription:
          '$(PRODUCT_NAME)이(가) 음성 입력을 위해 음성 인식에 접근하려고 합니다.',
        // 개발 환경 HTTP 허용
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
        // 푸시 알림 환경 설정
        'aps-environment': isProduction ? 'production' : 'development',
      },
    },

    // ==========================================================================
    // Android Configuration
    // ==========================================================================

    android: {
      package: envConfig.packageName,
      adaptiveIcon: {
        foregroundImage: ADAPTIVE_ICON,
        backgroundColor: BRAND_COLOR,
      },
      edgeToEdgeEnabled: true,
      // 개발 환경에서 HTTP 허용 (iOS의 NSAppTransportSecurity와 동일)
      ...(isDevelopment && {
        usesCleartextTraffic: true,
      }),
      intentFilters: [
        {
          action: 'VIEW',
          data: [
            {
              scheme: envConfig.scheme,
              host: 'auth',
              pathPrefix: '/kakao',
            },
            {
              scheme: envConfig.scheme,
              host: 'auth',
              pathPrefix: '/naver',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
      permissions: [
        // 카메라
        'CAMERA',
        // 저장소 (Android 12 이하)
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        // 미디어 (Android 13+)
        'READ_MEDIA_IMAGES',
        'READ_MEDIA_AUDIO',
        // 마이크 (음성 입력)
        'RECORD_AUDIO',
        // 캘린더
        'READ_CALENDAR',
        'WRITE_CALENDAR',
        // 진동 (햅틱 피드백)
        'VIBRATE',
        // 부팅 시 알림 스케줄링
        'RECEIVE_BOOT_COMPLETED',
        // 생체 인증
        'USE_BIOMETRIC',
        'USE_FINGERPRINT',
        // 알림
        'POST_NOTIFICATIONS',
        // 백그라운드 작업
        'FOREGROUND_SERVICE',
        'WAKE_LOCK',
      ],
      googleServicesFile: './google-services.json',
    },

    // ==========================================================================
    // Web Configuration
    // ==========================================================================

    web: {
      bundler: 'metro',
      output: 'static',
      favicon: FAVICON,
    },

    // ==========================================================================
    // Plugins & Features
    // ==========================================================================

    plugins: [
      // 라우팅
      'expo-router',

      // 폰트
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

      // 카메라
      [
        'expo-camera',
        {
          // biome-ignore lint/suspicious/noTemplateCurlyInString: iOS/Android 빌드 시스템 플레이스홀더
          cameraPermission: '${PRODUCT_NAME}이(가) 사진 촬영을 위해 카메라에 접근하려고 합니다.',
          microphonePermission:
            // biome-ignore lint/suspicious/noTemplateCurlyInString: iOS/Android 빌드 시스템 플레이스홀더
            '${PRODUCT_NAME}이(가) 동영상 녹화를 위해 마이크에 접근하려고 합니다.',
          recordAudioAndroid: true,
        },
      ],

      // 이미지 피커
      [
        'expo-image-picker',
        {
          photosPermission:
            // biome-ignore lint/suspicious/noTemplateCurlyInString: iOS/Android 빌드 시스템 플레이스홀더
            '${PRODUCT_NAME}이(가) 사진 선택을 위해 사진 라이브러리에 접근하려고 합니다.',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: iOS/Android 빌드 시스템 플레이스홀더
          cameraPermission: '${PRODUCT_NAME}이(가) 사진 촬영을 위해 카메라에 접근하려고 합니다.',
        },
      ],

      // 푸시 알림
      // TODO: notification-icon.png 추가 후 icon 설정
      [
        'expo-notifications',
        {
          // icon: NOTIFICATION_ICON,
          color: BRAND_COLOR,
          // TODO: 알림음 파일 추가 시 설정
          // sounds: ["./assets/sounds/notification.wav"],
        },
      ],

      // 캘린더
      [
        'expo-calendar',
        {
          calendarPermission:
            // biome-ignore lint/suspicious/noTemplateCurlyInString: iOS/Android 빌드 시스템 플레이스홀더
            '${PRODUCT_NAME}이(가) 일정 동기화를 위해 캘린더에 접근하려고 합니다.',
        },
      ],

      // 로컬 인증 (생체 인증 - Face ID, 지문)
      [
        'expo-local-authentication',
        {
          faceIDPermission:
            // biome-ignore lint/suspicious/noTemplateCurlyInString: iOS/Android 빌드 시스템 플레이스홀더
            '${PRODUCT_NAME}이(가) 앱 잠금 해제를 위해 Face ID를 사용하려고 합니다.',
        },
      ],

      // 보안 저장소 (토큰 저장)
      'expo-secure-store',

      // 시스템 UI (다크 모드 지원)
      'expo-system-ui',

      // SQLite (오프라인 DB)
      'expo-sqlite',

      // 백그라운드 작업
      'expo-task-manager',
      'expo-background-fetch',

      // 음성 인식 (STT)
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

      // 날짜/시간 선택기
      '@react-native-community/datetimepicker',
    ],

    // ==========================================================================
    // Experiments
    // ==========================================================================

    experiments: {
      typedRoutes: true,
    },
    newArchEnabled: true,

    // ==========================================================================
    // EAS Updates
    // ==========================================================================

    updates: {
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    },
    runtimeVersion: VERSION,

    // ==========================================================================
    // Environment Variables (accessible via Constants.expoConfig.extra)
    // ==========================================================================

    extra: {
      env,
      apiUrl: envConfig.apiUrl,
      isDevelopment,
      isProduction,
      eas: {
        projectId: EAS_PROJECT_ID,
      },
    },
  };
};
