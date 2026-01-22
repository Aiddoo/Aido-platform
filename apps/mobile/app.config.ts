import fs from 'node:fs';
import path from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// =============================================================================
// Types
// =============================================================================

type AppEnvironment = 'development' | 'preview' | 'production';

interface EnvironmentConfig {
  name: string;
  bundleIdentifier: string;
  packageName: string;
  scheme: string;
  apiUrl: string;
}

// =============================================================================
// Constants - Project
// =============================================================================

const EAS_PROJECT_ID = '185abed7-acd2-4d80-b652-cb3846e9806a';
const PROJECT_SLUG = 'aido';
const OWNER = 'aido-team';
const VERSION = '1.0.0';

// =============================================================================
// Constants - App
// =============================================================================

const APP_NAME = 'Aido';
const BUNDLE_IDENTIFIER = 'com.aido.mobile';
const PACKAGE_NAME = 'com.aido.mobile';
const SCHEME = 'aido';

// =============================================================================
// Constants - Branding
// =============================================================================

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
  switch (environment) {
    case 'production':
      return {
        name: APP_NAME,
        bundleIdentifier: BUNDLE_IDENTIFIER,
        packageName: PACKAGE_NAME,
        scheme: SCHEME,
        apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.example.com',
      };

    case 'preview':
      return {
        name: `${APP_NAME} Preview`,
        bundleIdentifier: `${BUNDLE_IDENTIFIER}.preview`,
        packageName: PACKAGE_NAME,
        scheme: `${SCHEME}-preview`,
        apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://preview-api.example.com',
      };
    default:
      return {
        name: `${APP_NAME} Development`,
        bundleIdentifier: `${BUNDLE_IDENTIFIER}.dev`,
        packageName: PACKAGE_NAME,
        scheme: `${SCHEME}-dev`,
        apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080',
      };
  }
};

// =============================================================================
// Main Configuration
// =============================================================================

export default ({ config }: ConfigContext): ExpoConfig => {
  // Resolve environment
  const rawEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
  const env: AppEnvironment =
    rawEnv === 'production' || rawEnv === 'preview' ? rawEnv : 'development';
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
      googleServicesFile: './GoogleService-Info.plist',
      config: {
        // false: HTTPS만 사용, 커스텀 암호화 없음 (App Store 제출 시 수출 규정 질문 스킵)
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        // 카메라 권한
        NSCameraUsageDescription: '할일에 사진을 첨부하기 위해 카메라 접근이 필요합니다.',
        // 사진 라이브러리 권한
        NSPhotoLibraryUsageDescription:
          '할일에 이미지를 첨부하기 위해 사진 라이브러리 접근이 필요합니다.',
        // 마이크 권한 (음성 입력)
        NSMicrophoneUsageDescription: '음성으로 할일을 추가하기 위해 마이크 접근이 필요합니다.',
        // 캘린더 권한
        NSCalendarsUsageDescription: '할일을 캘린더와 동기화하기 위해 접근이 필요합니다.',
        NSCalendarsWriteUsageDescription: '할일을 캘린더에 추가하기 위해 쓰기 권한이 필요합니다.',
        // Face ID 권한
        NSFaceIDUsageDescription: '앱 잠금 해제를 위해 Face ID를 사용합니다.',
        // 음성 인식 권한
        NSSpeechRecognitionUsageDescription:
          '음성으로 할일을 추가하기 위해 음성 인식이 필요합니다.',
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
          cameraPermission: '할일에 사진을 첨부하기 위해 카메라 접근이 필요합니다.',
          microphonePermission: '음성으로 할일을 추가하기 위해 마이크 접근이 필요합니다.',
          recordAudioAndroid: true,
        },
      ],

      // 이미지 피커
      [
        'expo-image-picker',
        {
          photosPermission: '할일에 이미지를 첨부하기 위해 사진 라이브러리 접근이 필요합니다.',
          cameraPermission: '할일에 사진을 첨부하기 위해 카메라 접근이 필요합니다.',
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
          calendarPermission: '할일을 캘린더와 동기화하기 위해 접근이 필요합니다.',
        },
      ],

      // 로컬 인증 (생체 인증 - Face ID, 지문)
      [
        'expo-local-authentication',
        {
          faceIDPermission: '앱 잠금 해제를 위해 Face ID를 사용합니다.',
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
