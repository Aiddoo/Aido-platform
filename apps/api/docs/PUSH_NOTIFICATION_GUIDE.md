# Expo Push Notification 구현 가이드

> Aido 프로젝트의 푸시 알림 시스템 전체 아키텍처 및 구현 가이드

---

## 목차

1. [개요](#1-개요)
2. [서버 아키텍처 (구현 완료)](#2-서버-아키텍처-구현-완료)
3. [모바일 앱 구현 가이드](#3-모바일-앱-구현-가이드)
4. [알림 타입 및 링크 처리](#4-알림-타입-및-링크-처리)
5. [데이터베이스 스키마](#5-데이터베이스-스키마)
6. [테스트 가이드](#6-테스트-가이드)

---

## 1. 개요

### 1.1 Expo Push Notification 동작 방식

```
 모바일 앱                      Expo Server                    API 서버
    |                              |                              |
    |-- 1) 토큰 발급 요청 -------->|                              |
    |<-- 2) ExponentPushToken ----|                              |
    |                              |                              |
    |-- 3) 토큰 등록 (HTTP) ---------------------------------->|
    |                              |                              |
    |                              |<-- 4) 푸시 발송 요청 --------|
    |<-- 5) 푸시 메시지 -----------|                              |
```

**핵심 포인트:**
- 실제 기기만 토큰 발급 가능 (iOS 시뮬레이터/Android 에뮬레이터 불가)
- 토큰 형식: `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`
- 서버에서 expo-server-sdk를 통해 Expo Server로 푸시 발송

### 1.2 현재 구현 현황

| 구분 | 항목 | 상태 |
|------|------|------|
| API 서버 | 푸시 토큰 등록/해제 API | 완료 |
| | 알림 CRUD API | 완료 |
| | Expo 푸시 발송 (ExpoPushProvider) | 완료 |
| | 이벤트 기반 알림 생성 | 완료 |
| | 사용자 설정 기반 필터링 | 완료 |
| 모바일 앱 | expo-notifications 패키지 | 설치됨 (v0.32.16) |
| | app.config.ts 설정 | 완료 |
| | 알림 설정 화면 UI | 완료 |
| | 푸시 토큰 요청/등록 | **미구현** |
| | 알림 수신 리스너 | **미구현** |
| | 알림 클릭 핸들링 | **미구현** |

---

## 2. 서버 아키텍처 (구현 완료)

### 2.1 모듈 구조

```
apps/api/src/modules/notification/
├── notification.module.ts           # DI 설정
├── notification.controller.ts       # REST API 엔드포인트
├── notification.service.ts          # 핵심 비즈니스 로직
├── notification.repository.ts       # Prisma DB 쿼리
├── notification.mapper.ts           # Entity -> DTO 변환
├── providers/
│   ├── push-provider.interface.ts   # Provider 인터페이스 (Strategy Pattern)
│   └── expo-push.provider.ts        # Expo SDK 구현체
├── listeners/
│   ├── follow.listener.ts           # FOLLOW_NEW, FOLLOW_MUTUAL
│   ├── todo.listener.ts             # TODO_ALL_COMPLETED, TODO_REMINDER, FRIEND_COMPLETED
│   ├── nudge.listener.ts            # NUDGE_SENT
│   └── cheer.listener.ts            # CHEER_SENT
├── templates/
│   └── notification-templates.ts    # 메시지 템플릿 + 빌더
├── events/
│   └── notification.events.ts       # 이벤트 정의
└── utils/
    └── night-time.util.ts           # 야간 시간대 판단 (KST 21:00-08:00)
```

### 2.2 API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/notifications/token` | 푸시 토큰 등록 |
| DELETE | `/notifications/token` | 푸시 토큰 해제 |
| GET | `/notifications` | 알림 목록 조회 (커서 페이지네이션) |
| GET | `/notifications/unread-count` | 읽지 않은 알림 수 |
| PATCH | `/notifications/:id/read` | 단일 알림 읽음 처리 |
| PATCH | `/notifications/read-all` | 모든 알림 읽음 처리 |

### 2.3 푸시 발송 필터링 로직

`NotificationService.shouldSendPush()` 메서드:

```
1. pushEnabled === false → 발송 안 함
2. 야간 시간대 (KST 21:00-08:00) && nightPushEnabled === false → 발송 안 함
3. 마케팅 알림 && marketingAgreedAt === null → 발송 안 함
4. 모든 조건 통과 → 발송
```

알림은 **항상 DB에 저장**되며, 푸시 발송 여부만 필터링됩니다.

### 2.4 이벤트 기반 알림 흐름

```
[TodoModule]
  |
  | 할일 완료 처리
  v
eventEmitter.emit('todo.all_completed', { userId, completedCount })
  |
  v
[TodoListener.handleTodoAllCompleted]
  |
  |-- 본인에게 완료 축하 알림 (DAILY_COMPLETE)
  |
  |-- 친구들에게 이벤트 발행
  v
eventEmitter.emit('friend.completed', { friendId, friendName, notifyUserIds })
  |
  v
[TodoListener.handleFriendCompleted]
  |
  |-- 친구들에게 배치 알림 발송 (FRIEND_COMPLETED)
  |-- route: "/friends/{friendId}"
```

---

## 3. 모바일 앱 구현 가이드

### 3.1 Feature 디렉토리 구조

```
apps/mobile/src/features/notification/
├── models/
│   ├── notification.model.ts          # 타입 정의
│   └── notification.error.ts          # ClientError (expo-notifications 타입 활용)
├── repositories/
│   ├── notification.repository.ts     # HTTP API 인터페이스
│   ├── notification.repository.impl.ts # HTTP API 구현체
│   ├── device-id.repository.ts        # deviceId 저장 인터페이스
│   └── device-id.repository.impl.ts   # deviceId 저장 구현체 (Storage 주입)
├── services/
│   ├── notification.service.ts        # 비즈니스 로직
│   ├── notification.mapper.ts         # DTO -> Domain
│   ├── device-id.service.ts           # deviceId 생성/관리
│   ├── push-token.service.ts          # expo-notifications 래핑
│   └── badge.service.ts               # 뱃지 숫자 관리
└── presentations/
    ├── constants/
    │   └── notification-query-keys.constant.ts
    ├── queries/
    │   ├── register-token-mutation-options.ts
    │   ├── get-notifications-query-options.ts
    │   └── mark-read-mutation-options.ts
    └── hooks/
        ├── use-register-push-token.ts
        └── use-notification-observer.ts
```

### 3.2 NotificationClientError 구현 (expo-notifications 타입 활용)

```typescript
// apps/mobile/src/features/notification/models/notification.error.ts
import { PermissionStatus } from 'expo-notifications';
import { ClientError } from '@src/shared/infra/errors/client-error';

export type NotificationErrorReason =
  | 'PERMISSION_DENIED'
  | 'PERMISSION_UNDETERMINED'
  | 'TOKEN_REGISTRATION_FAILED'
  | 'NOT_PHYSICAL_DEVICE'
  | 'PROJECT_ID_NOT_FOUND'
  | 'NETWORK_ERROR';

export class NotificationClientError extends ClientError<NotificationErrorReason> {
  // expo-notifications의 PermissionStatus 활용
  static fromPermissionStatus(status: PermissionStatus) {
    switch (status) {
      case PermissionStatus.DENIED:
        return new NotificationClientError(
          'PERMISSION_DENIED',
          '알림 권한이 거부되었습니다. 설정에서 권한을 허용해주세요.',
        );
      case PermissionStatus.UNDETERMINED:
        return new NotificationClientError(
          'PERMISSION_UNDETERMINED',
          '알림 권한이 아직 결정되지 않았습니다.',
        );
      default:
        return null;
    }
  }

  static permissionDenied() {
    return new NotificationClientError(
      'PERMISSION_DENIED',
      '알림 권한이 거부되었습니다. 설정에서 권한을 허용해주세요.',
    );
  }

  static notPhysicalDevice() {
    return new NotificationClientError(
      'NOT_PHYSICAL_DEVICE',
      '시뮬레이터에서는 푸시 알림을 지원하지 않습니다. 실제 기기를 사용해주세요.',
    );
  }

  static projectIdNotFound() {
    return new NotificationClientError(
      'PROJECT_ID_NOT_FOUND',
      'EAS Project ID를 찾을 수 없습니다. app.config.ts를 확인해주세요.',
    );
  }

  static tokenRegistrationFailed(originalError?: Error) {
    return new NotificationClientError(
      'TOKEN_REGISTRATION_FAILED',
      `푸시 토큰 등록에 실패했습니다: ${originalError?.message ?? 'Unknown error'}`,
    );
  }

  static networkError(originalError?: Error) {
    return new NotificationClientError(
      'NETWORK_ERROR',
      `네트워크 오류가 발생했습니다: ${originalError?.message ?? 'Unknown error'}`,
    );
  }
}
```

### 3.3 PushTokenService 구현 (expo-notifications 타입 활용)

> Expo 공식 문서 기반 구현 (https://docs.expo.dev/versions/latest/sdk/notifications/)

```typescript
// apps/mobile/src/features/notification/services/push-token.service.ts
import * as Notifications from 'expo-notifications';
import {
  PermissionStatus,
  type NotificationPermissionsStatus,
  type ExpoPushToken,
  AndroidImportance,
} from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { NotificationClientError } from '../models/notification.error';
import type { DeviceIdService } from './device-id.service';

export interface PushTokenResult {
  token: string;
  deviceId: string;
}

export class PushTokenService {
  constructor(private readonly _deviceIdService: DeviceIdService) {}

  isPhysicalDevice(): boolean {
    return Device.isDevice;
  }

  async getPermissionStatus(): Promise<NotificationPermissionsStatus> {
    return Notifications.getPermissionsAsync();
  }

  async allowsNotifications(): Promise<boolean> {
    const settings = await this.getPermissionStatus();
    // iOS provisional 권한도 허용으로 처리
    return (
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  }

  async requestPermissions(): Promise<PermissionStatus> {
    if (!this.isPhysicalDevice()) {
      throw NotificationClientError.notPhysicalDevice();
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    // 이미 granted면 바로 반환
    if (existingStatus === PermissionStatus.GRANTED) {
      await this.setupAndroidChannel();
      return PermissionStatus.GRANTED;
    }

    // 권한 요청
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (status === PermissionStatus.GRANTED) {
      await this.setupAndroidChannel();
    }

    return status;
  }

  private async setupAndroidChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;

    // expo-notifications의 AndroidImportance enum 활용
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  async getExpoPushToken(): Promise<PushTokenResult> {
    const permissionStatus = await this.requestPermissions();

    // expo-notifications의 PermissionStatus enum으로 정확한 비교
    if (permissionStatus !== PermissionStatus.GRANTED) {
      const error = NotificationClientError.fromPermissionStatus(permissionStatus);
      if (error) throw error;
      throw NotificationClientError.permissionDenied();
    }

    // EAS projectId 가져오기
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

    if (!projectId) {
      throw NotificationClientError.projectIdNotFound();
    }

    try {
      // expo-notifications의 ExpoPushToken 타입 활용
      const tokenData: ExpoPushToken = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      // DeviceIdService를 통해 영구적인 deviceId 가져오기
      const deviceId = await this._deviceIdService.getOrCreateDeviceId();

      return {
        token: tokenData.data,
        deviceId,
      };
    } catch (error) {
      throw NotificationClientError.tokenRegistrationFailed(
        error instanceof Error ? error : undefined,
      );
    }
  }
}
```

### 3.4 NotificationService 구현

```typescript
// apps/mobile/src/features/notification/services/notification.service.ts
import { PermissionStatus } from 'expo-notifications';
import type { NotificationRepository } from '../repositories/notification.repository';
import type { PushTokenService } from './push-token.service';
import type { BadgeService } from './badge.service';
import { NotificationClientError } from '../models/notification.error';

export class NotificationService {
  constructor(
    private readonly _repository: NotificationRepository,
    private readonly _pushTokenService: PushTokenService,
    private readonly _badgeService: BadgeService,
  ) {}

  async setupPushNotifications(): Promise<void> {
    if (!this._pushTokenService.isPhysicalDevice()) {
      console.warn('[Notification] Skipped: Not a physical device');
      return;
    }

    try {
      const { token, deviceId } = await this._pushTokenService.getExpoPushToken();
      await this._repository.registerToken({ token, deviceId });
      console.log('[Notification] Token registered:', token);
    } catch (error) {
      if (error instanceof NotificationClientError) {
        // expo-notifications 권한 관련 에러는 조용히 처리
        if (
          error.reason === 'PERMISSION_DENIED' ||
          error.reason === 'PERMISSION_UNDETERMINED'
        ) {
          console.log(`[Notification] ${error.message}`);
          return;
        }
      }
      throw error;
    }
  }

  async checkPermissionStatus(): Promise<PermissionStatus> {
    const { status } = await this._pushTokenService.getPermissionStatus();
    return status;
  }

  async isNotificationEnabled(): Promise<boolean> {
    return this._pushTokenService.allowsNotifications();
  }

  async removePushToken(deviceId?: string): Promise<void> {
    await this._repository.unregisterToken(deviceId);
  }

  async getNotifications(params: {
    cursor?: number;
    limit?: number;
    unreadOnly?: boolean;
  }) {
    return this._repository.getNotifications(params);
  }

  async getUnreadCount(): Promise<number> {
    const { unreadCount } = await this._repository.getUnreadCount();
    return unreadCount;
  }

  async markAsRead(notificationId: number): Promise<void> {
    await this._repository.markAsRead(notificationId);
  }

  async markAllAsRead(): Promise<void> {
    await this._repository.markAllAsRead();
  }
}
```

### 3.5 NotificationRepository 구현

```typescript
// apps/mobile/src/features/notification/repositories/notification.repository.ts
import type {
  RegisterPushTokenInput,
  GetNotificationsQuery,
  NotificationListResponse,
} from '@aido/validators';

export interface NotificationRepository {
  registerToken(input: RegisterPushTokenInput): Promise<{ message: string; registered: boolean }>;
  unregisterToken(deviceId?: string): Promise<{ message: string; registered: boolean }>;
  getNotifications(query: GetNotificationsQuery): Promise<NotificationListResponse>;
  getUnreadCount(): Promise<{ unreadCount: number }>;
  markAsRead(notificationId: number): Promise<{ message: string; readCount: number }>;
  markAllAsRead(): Promise<{ message: string; readCount: number }>;
}
```

```typescript
// apps/mobile/src/features/notification/repositories/notification.repository.impl.ts
import type { HttpClient } from '@src/core/ports/http';
import {
  notificationListResponseSchema,
  unreadCountResponseSchema,
  registerTokenResponseSchema,
  markReadResponseSchema,
  type RegisterPushTokenInput,
  type GetNotificationsQuery,
} from '@aido/validators';
import type { NotificationRepository } from './notification.repository';

export class NotificationRepositoryImpl implements NotificationRepository {
  constructor(private readonly _httpClient: HttpClient) {}

  async registerToken(input: RegisterPushTokenInput) {
    const { data } = await this._httpClient.post('v1/notifications/token', { json: input });
    return registerTokenResponseSchema.parse(data);
  }

  async unregisterToken(deviceId?: string) {
    const searchParams = deviceId ? { deviceId } : undefined;
    const { data } = await this._httpClient.delete('v1/notifications/token', { searchParams });
    return registerTokenResponseSchema.parse(data);
  }

  async getNotifications(query: GetNotificationsQuery) {
    const { data } = await this._httpClient.get('v1/notifications', {
      searchParams: query as Record<string, unknown>,
    });
    return notificationListResponseSchema.parse(data);
  }

  async getUnreadCount() {
    const { data } = await this._httpClient.get('v1/notifications/unread-count');
    return unreadCountResponseSchema.parse(data);
  }

  async markAsRead(notificationId: number) {
    const { data } = await this._httpClient.patch(`v1/notifications/${notificationId}/read`);
    return markReadResponseSchema.parse(data);
  }

  async markAllAsRead() {
    const { data } = await this._httpClient.patch('v1/notifications/read-all');
    return markReadResponseSchema.parse(data);
  }
}
```

### 3.6 알림 Observer Hook (expo-notifications 타입 활용)

> Expo 공식 문서: Handle push notifications with Expo Router navigation

```typescript
// apps/mobile/src/features/notification/presentations/hooks/use-notification-observer.ts
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import type {
  Notification,
  NotificationResponse,
  NotificationBehavior,
} from 'expo-notifications';

// expo-notifications의 NotificationBehavior 타입 활용
const FOREGROUND_NOTIFICATION_BEHAVIOR: NotificationBehavior = {
  shouldPlaySound: true,
  shouldSetBadge: true,
  shouldShowBanner: true,
  shouldShowList: true,
};

// 포그라운드 알림 표시 설정
Notifications.setNotificationHandler({
  handleNotification: async () => FOREGROUND_NOTIFICATION_BEHAVIOR,
});

// expo-notifications의 Notification 타입 활용
function handleNotificationResponse(notification: Notification): void {
  const data = notification.request.content.data;

  // Internal link: route 필드로 앱 내 화면 이동
  if (data.route && typeof data.route === 'string') {
    router.push(data.route as any);
    return;
  }

  // External link: metadata.externalUrl로 외부 URL 열기
  if (data.metadata?.externalUrl && typeof data.metadata.externalUrl === 'string') {
    Linking.openURL(data.metadata.externalUrl);
    return;
  }
}

export function useNotificationObserver() {
  useEffect(() => {
    // 앱이 종료된 상태에서 알림 클릭으로 앱이 열린 경우
    // expo-notifications의 NotificationResponse 타입
    const lastResponse: NotificationResponse | null =
      Notifications.getLastNotificationResponse();

    if (lastResponse?.notification) {
      handleNotificationResponse(lastResponse.notification);
    }

    // 앱이 실행 중일 때 알림 클릭
    // expo-notifications의 Subscription 타입 반환
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response: NotificationResponse) => {
        handleNotificationResponse(response.notification);
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);
}
```

### 3.7 알림 수신 리스너 Hook (포그라운드 알림)

```typescript
// apps/mobile/src/features/notification/presentations/hooks/use-notification-received.ts
import { useEffect, useState, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import type { Notification } from 'expo-notifications';

export function useNotificationReceived() {
  // expo-notifications의 Notification 타입 활용
  const [lastNotification, setLastNotification] = useState<Notification | null>(null);

  useEffect(() => {
    // 포그라운드에서 알림 수신 시 호출
    const subscription = Notifications.addNotificationReceivedListener(
      (notification: Notification) => {
        console.log('[Notification] Received in foreground:', notification);
        setLastNotification(notification);
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const clearLastNotification = useCallback(() => {
    setLastNotification(null);
  }, []);

  return {
    lastNotification,
    clearLastNotification,
  };
}
```

### 3.8 푸시 토큰 등록 Hook

```typescript
// apps/mobile/src/features/notification/presentations/hooks/use-register-push-token.ts
import { useMutation } from '@tanstack/react-query';
import { useDI } from '@src/bootstrap/providers/di-provider';
import { NotificationClientError } from '../../models/notification.error';

export function useRegisterPushToken() {
  const { notificationService } = useDI();

  return useMutation({
    mutationFn: () => notificationService.setupPushNotifications(),
    onError: (error) => {
      if (error instanceof NotificationClientError) {
        // 권한 거부는 정상적인 사용자 선택
        if (
          error.reason === 'PERMISSION_DENIED' ||
          error.reason === 'PERMISSION_UNDETERMINED' ||
          error.reason === 'NOT_PHYSICAL_DEVICE'
        ) {
          console.log(`[Notification] ${error.reason}: ${error.message}`);
          return;
        }
      }
      console.error('[Notification] Token registration failed:', error);
    },
  });
}
```

### 3.9 권한 상태 확인 Hook

```typescript
// apps/mobile/src/features/notification/presentations/hooks/use-notification-permission.ts
import { useQuery } from '@tanstack/react-query';
import { PermissionStatus } from 'expo-notifications';
import { useDI } from '@src/bootstrap/providers/di-provider';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';

export function useNotificationPermission() {
  const { notificationService } = useDI();

  const { data: permissionStatus, refetch } = useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.permission(),
    queryFn: () => notificationService.checkPermissionStatus(),
  });

  const isGranted = permissionStatus === PermissionStatus.GRANTED;
  const isDenied = permissionStatus === PermissionStatus.DENIED;
  const isUndetermined = permissionStatus === PermissionStatus.UNDETERMINED;

  return {
    permissionStatus,
    isGranted,
    isDenied,
    isUndetermined,
    refetch,
  };
}
```

### 3.10 Query Keys 상수

```typescript
// apps/mobile/src/features/notification/presentations/constants/notification-query-keys.constant.ts
export const NOTIFICATION_QUERY_KEYS = {
  all: ['notification'] as const,
  list: () => [...NOTIFICATION_QUERY_KEYS.all, 'list'] as const,
  unreadCount: () => [...NOTIFICATION_QUERY_KEYS.all, 'unreadCount'] as const,
  permission: () => [...NOTIFICATION_QUERY_KEYS.all, 'permission'] as const,
} as const;
```

### 3.11 DI Provider 등록

```typescript
// apps/mobile/src/bootstrap/providers/di-provider.tsx
import { DeviceIdRepositoryImpl } from '@src/features/notification/repositories/device-id.repository.impl';
import { NotificationRepositoryImpl } from '@src/features/notification/repositories/notification.repository.impl';
import { DeviceIdService } from '@src/features/notification/services/device-id.service';
import { NotificationService } from '@src/features/notification/services/notification.service';
import { PushTokenService } from '@src/features/notification/services/push-token.service';
import { BadgeService } from '@src/features/notification/services/badge.service';

// DIContainer 인터페이스에 추가
interface DIContainer {
  // ... 기존 서비스들
  notificationService: NotificationService;
}

// 인스턴스 생성 (의존성 순서대로)
// 1. Repository 레이어 (Storage 주입)
const deviceIdRepository = new DeviceIdRepositoryImpl(storage);  // storage는 기존 SecureStorage 인스턴스
const notificationRepository = new NotificationRepositoryImpl(authHttpClient);

// 2. Service 레이어 (Repository/Service 주입)
const deviceIdService = new DeviceIdService(deviceIdRepository);
const pushTokenService = new PushTokenService(deviceIdService);
const badgeService = new BadgeService();
const notificationService = new NotificationService(
  notificationRepository,
  pushTokenService,
  badgeService,
);

const container: DIContainer = {
  // ... 기존 서비스들
  notificationService,
};
```

**의존성 그래프:**
```
storage (SecureStorage)
    └── deviceIdRepository (DeviceIdRepositoryImpl)
            └── deviceIdService (DeviceIdService)
                    └── pushTokenService (PushTokenService)
                            └── notificationService (NotificationService)
                                    ├── notificationRepository
                                    └── badgeService
```

### 3.12 Root Layout에 Observer 등록

```typescript
// apps/mobile/app/_layout.tsx
import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { useAuth } from '@src/features/auth/presentations/hooks/use-auth';
import { useNotificationObserver } from '@src/features/notification/presentations/hooks/use-notification-observer';
import { useRegisterPushToken } from '@src/features/notification/presentations/hooks/use-register-push-token';

export default function RootLayout() {
  const { isAuthenticated } = useAuth();
  const registerPushToken = useRegisterPushToken();

  // 전역 알림 리스너
  useNotificationObserver();

  // 로그인 시 푸시 토큰 자동 등록
  useEffect(() => {
    if (isAuthenticated) {
      registerPushToken.mutate();
    }
  }, [isAuthenticated]);

  return <Slot />;
}
```

### 3.13 로그인/로그아웃 연동

**로그인 성공 후:**
```typescript
const loginMutation = useLoginMutation();
const registerPushToken = useRegisterPushToken();

const handleLogin = async (email: string, password: string) => {
  await loginMutation.mutateAsync({ email, password });
  registerPushToken.mutate(); // 비동기, 실패해도 로그인은 성공
  router.replace('/(tabs)/');
};
```

**로그아웃 시:**
```typescript
const { notificationService } = useDI();

const handleLogout = async () => {
  await notificationService.removePushToken();
  await logoutMutation.mutateAsync();
  router.replace('/(auth)/login');
};
```

---

## 4. 알림 타입 및 링크 처리

### 4.1 알림 타입 목록

| 카테고리 | 타입 | 설명 |
|---------|------|------|
| 친구 상호작용 | `FOLLOW_NEW` | 새로운 팔로우 요청 |
| | `FOLLOW_ACCEPTED` | 맞팔로우 성립 |
| | `NUDGE_RECEIVED` | 독촉 받음 |
| | `CHEER_RECEIVED` | 응원 받음 |
| 할일 관련 | `DAILY_COMPLETE` | 오늘 할일 전부 완료 |
| | `TODO_REMINDER` | 마감 1시간 전 리마인더 |
| | `MORNING_REMINDER` | 아침 할일 알림 |
| | `EVENING_REMINDER` | 저녁 진행상황 알림 |
| 친구 활동 | `FRIEND_COMPLETED` | 친구가 할일 완료 |
| 시스템 | `WEEKLY_ACHIEVEMENT` | 주간 달성 리포트 |
| | `SYSTEM_NOTICE` | 공지사항 |

### 4.2 Internal Link (인앱 라우팅)

**`route` 필드**를 사용하여 Expo Router로 앱 내 화면 이동:

| 알림 타입 | route 예시 | 설명 |
|----------|-----------|------|
| `FOLLOW_NEW` | `/friends/requests` | 친구 요청 목록 |
| `FOLLOW_ACCEPTED` | `/friends/{friendId}` | 친구 프로필 |
| `NUDGE_RECEIVED` | `/todos/{todoId}` | 해당 할일 상세 |
| `CHEER_RECEIVED` | `/friends/{senderId}` | 응원 보낸 친구 |
| `TODO_REMINDER` | `/todos/{todoId}` | 마감 예정 할일 |
| `FRIEND_COMPLETED` | `/friends/{friendId}` | 완료한 친구 프로필 |
| `DAILY_COMPLETE` | `/` | 홈 화면 |

### 4.3 External Link (외부 URL)

**`metadata.externalUrl` 필드**를 사용하여 외부 웹페이지 열기:

```json
{
  "type": "SYSTEM_NOTICE",
  "title": "새로운 이벤트 안내",
  "body": "지금 참여하고 혜택 받으세요!",
  "route": null,
  "metadata": {
    "externalUrl": "https://aido.kr/events/new-year"
  }
}
```

### 4.4 클라이언트 통합 처리

```typescript
import type { Notification } from 'expo-notifications';

function handleNotificationResponse(notification: Notification): void {
  const data = notification.request.content.data;

  // 1. Internal link: route 필드
  if (data.route && typeof data.route === 'string') {
    router.push(data.route as any);
    return;
  }

  // 2. External link: metadata.externalUrl 필드
  if (data.metadata?.externalUrl && typeof data.metadata.externalUrl === 'string') {
    Linking.openURL(data.metadata.externalUrl);
    return;
  }
}
```

---

## 5. 데이터베이스 스키마

### 5.1 PushToken 테이블

```prisma
model PushToken {
  id         Int       @id @default(autoincrement())
  userId     String
  token      String    @unique @db.VarChar(255)
  deviceId   String    @db.VarChar(255)
  platform   Platform  // IOS | ANDROID
  isActive   Boolean   @default(true)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  lastUsedAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, deviceId])
  @@index([userId, isActive])
}

enum Platform {
  IOS
  ANDROID
}
```

### 5.2 Notification 테이블

```prisma
model Notification {
  id        Int              @id @default(autoincrement())
  userId    String
  type      NotificationType
  title     String           @db.VarChar(200)
  body      String           @db.VarChar(500)
  isRead    Boolean          @default(false)
  route     String?          @db.VarChar(200)  // 인앱 경로
  todoId    Int?
  friendId  String?
  nudgeId   Int?
  cheerId   Int?
  metadata  Json?            // { externalUrl?: string, ... }
  createdAt DateTime  @default(now())
  readAt    DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead, createdAt])
  @@index([userId, type])
  @@index([createdAt])
}

enum NotificationType {
  FOLLOW_NEW
  FOLLOW_ACCEPTED
  NUDGE_RECEIVED
  CHEER_RECEIVED
  DAILY_COMPLETE
  FRIEND_COMPLETED
  TODO_REMINDER
  MORNING_REMINDER
  EVENING_REMINDER
  WEEKLY_ACHIEVEMENT
  SYSTEM_NOTICE
}
```

---

## 6. 테스트 가이드

### 6.1 개발 환경 준비

```bash
# 터미널 1: PostgreSQL
cd ~/Desktop/Aido
pnpm docker:up

# 터미널 2: API 서버
pnpm dev --filter=@aido/api

# 실제 기기에서 Development 빌드 실행
cd apps/mobile
pnpm build:development
```

**중요:** 푸시 토큰은 **실제 기기에서만** 발급 가능합니다.

### 6.2 테스트 체크리스트

**1단계: 토큰 등록**
- [ ] 실제 기기에서 앱 설치
- [ ] 로그인 성공
- [ ] 알림 권한 요청 팝업 표시
- [ ] 권한 허용
- [ ] API 서버 로그에서 토큰 등록 확인

**2단계: 푸시 발송**
- [ ] https://expo.dev/notifications 에서 테스트 발송
- [ ] 또는 API 이벤트 트리거 (할일 완료 등)
- [ ] 기기에서 알림 수신 확인

**3단계: 딥링크**
- [ ] 푸시 알림 클릭
- [ ] route에 지정된 화면으로 이동 확인

**4단계: 로그아웃**
- [ ] 로그아웃 실행
- [ ] 서버에서 토큰 삭제 확인
- [ ] 푸시 미수신 확인

### 6.3 에러 시나리오

| 시나리오 | PermissionStatus | 예상 동작 |
|---------|-----------------|----------|
| 시뮬레이터에서 실행 | - | `NOT_PHYSICAL_DEVICE` 에러, 조용히 무시 |
| 권한 거부 | `DENIED` | `PERMISSION_DENIED` 에러, 조용히 무시 |
| 권한 미결정 | `UNDETERMINED` | 권한 요청 팝업 표시 |
| 권한 허용 | `GRANTED` | 토큰 발급 및 등록 진행 |
| 네트워크 에러 | - | `NETWORK_ERROR`, 다음 로그인 시 재등록 |

---

## 참고 자료

### 공식 문서

- [Expo Push Notifications Overview](https://docs.expo.dev/push-notifications/overview/)
- [Expo Push Notifications Setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [expo-notifications API Reference](https://docs.expo.dev/versions/latest/sdk/notifications/)

### expo-notifications 주요 타입

```typescript
import {
  PermissionStatus,           // 'granted' | 'denied' | 'undetermined'
  NotificationPermissionsStatus,
  ExpoPushToken,
  Notification,
  NotificationResponse,
  NotificationBehavior,
  AndroidImportance,
  IosAuthorizationStatus,
} from 'expo-notifications';
```

### 프로젝트 파일 위치

**API 서버:**
- `apps/api/src/modules/notification/notification.controller.ts`
- `apps/api/src/modules/notification/notification.service.ts`
- `apps/api/src/modules/notification/providers/expo-push.provider.ts`
- `apps/api/src/modules/notification/listeners/`

**공유 스키마:**
- `packages/validators/src/domains/notification/`

---

## 7. 고급 기능 구현

### 7.1 deviceId 생성 전략 개선

서버는 `userId + deviceId` 조합으로 unique constraint를 적용합니다. 안정적인 deviceId를 생성하면 동일 기기에서 재설치해도 같은 토큰을 재활용할 수 있습니다.

#### 서버 지원 현황

```typescript
// apps/api/src/modules/notification/notification.repository.ts:207-221
// deviceId가 없으면 기본값 사용
const deviceId = data.deviceId ?? "default";

// upsert로 userId+deviceId 조합 unique 처리
await db.pushToken.upsert({
  where: {
    userId_deviceId: { userId, deviceId },
  },
  update: { token, lastUsedAt: new Date() },
  create: { userId, deviceId, token, platform },
});
```

#### 아키텍처 패턴: Repository를 통한 Storage 추상화

기존 Auth feature와 동일한 DI 패턴을 적용합니다:

```
DeviceIdService
    └── DeviceIdRepository (인터페이스)
            └── DeviceIdRepositoryImpl
                    └── Storage (core/ports 인터페이스)
                            └── SecureStorage (shared/infra 구현체)
                                    └── expo-secure-store
```

**장점:**
- 기존 `SecureStorage` 인프라 재사용
- DI 패턴 일관성 유지 (Auth feature와 동일)
- 테스트 시 `DeviceIdRepository` 모킹 가능

#### DeviceIdRepository 인터페이스

```typescript
// apps/mobile/src/features/notification/repositories/device-id.repository.ts
export interface DeviceIdRepository {
  getDeviceId(): Promise<string | null>;
  saveDeviceId(deviceId: string): Promise<void>;
  clearDeviceId(): Promise<void>;
}
```

#### DeviceIdRepository 구현체

```typescript
// apps/mobile/src/features/notification/repositories/device-id.repository.impl.ts
import type { Storage } from '@src/core/ports/storage';
import type { DeviceIdRepository } from './device-id.repository';

const DEVICE_ID_KEY = 'aido_device_id';

export class DeviceIdRepositoryImpl implements DeviceIdRepository {
  constructor(private readonly _storage: Storage) {}

  async getDeviceId(): Promise<string | null> {
    return this._storage.get<string>(DEVICE_ID_KEY);
  }

  async saveDeviceId(deviceId: string): Promise<void> {
    await this._storage.set(DEVICE_ID_KEY, deviceId);
  }

  async clearDeviceId(): Promise<void> {
    await this._storage.remove(DEVICE_ID_KEY);
  }
}
```

#### DeviceIdService (Repository 주입)

```typescript
// apps/mobile/src/features/notification/services/device-id.service.ts
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import type { DeviceIdRepository } from '../repositories/device-id.repository';

export class DeviceIdService {
  constructor(private readonly _repository: DeviceIdRepository) {}

  /**
   * 영구적인 deviceId를 가져옵니다.
   * 처음 호출 시 생성하여 Repository를 통해 저장합니다.
   */
  async getOrCreateDeviceId(): Promise<string> {
    try {
      // 1. Repository에서 기존 ID 조회
      const existingId = await this._repository.getDeviceId();
      if (existingId) {
        return existingId;
      }

      // 2. 새로운 ID 생성
      const newDeviceId = await this.generateDeviceId();

      // 3. Repository에 저장
      await this._repository.saveDeviceId(newDeviceId);

      return newDeviceId;
    } catch (error) {
      // Storage 실패 시 fallback (메모리에서만 유지)
      console.warn('[DeviceId] Storage failed, using fallback:', error);
      return this.generateFallbackId();
    }
  }

  private async generateDeviceId(): Promise<string> {
    // iOS: identifierForVendor (앱 재설치 시 유지)
    // Android: androidId (기기 초기화 전까지 유지)
    const nativeId =
      Platform.OS === 'ios'
        ? await Application.getIosIdForVendorAsync()
        : Application.getAndroidId();

    if (nativeId) {
      // 네이티브 ID + 앱 고유 식별자 조합
      const bundleId = Application.applicationId ?? 'aido';
      return `${Platform.OS}-${this.hashString(`${nativeId}-${bundleId}`)}`;
    }

    // 네이티브 ID 없는 경우 랜덤 UUID 생성
    return this.generateFallbackId();
  }

  private generateFallbackId(): string {
    const uuid = Crypto.randomUUID();
    return `${Platform.OS}-${uuid}`;
  }

  private hashString(input: string): string {
    // 간단한 해시 (보안용이 아닌 고유성 목적)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 디바이스 ID 초기화 (디버그/테스트용)
   */
  async clearDeviceId(): Promise<void> {
    await this._repository.clearDeviceId();
  }
}
```

#### PushTokenService (DeviceIdService 주입)

```typescript
// apps/mobile/src/features/notification/services/push-token.service.ts
import * as Notifications from 'expo-notifications';
import {
  PermissionStatus,
  type NotificationPermissionsStatus,
  type ExpoPushToken,
  AndroidImportance,
} from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { NotificationClientError } from '../models/notification.error';
import type { DeviceIdService } from './device-id.service';

export interface PushTokenResult {
  token: string;
  deviceId: string;
}

export class PushTokenService {
  constructor(private readonly _deviceIdService: DeviceIdService) {}

  isPhysicalDevice(): boolean {
    return Device.isDevice;
  }

  async getPermissionStatus(): Promise<NotificationPermissionsStatus> {
    return Notifications.getPermissionsAsync();
  }

  async allowsNotifications(): Promise<boolean> {
    const settings = await this.getPermissionStatus();
    return (
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  }

  async requestPermissions(): Promise<PermissionStatus> {
    if (!this.isPhysicalDevice()) {
      throw NotificationClientError.notPhysicalDevice();
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus === PermissionStatus.GRANTED) {
      await this.setupAndroidChannel();
      return PermissionStatus.GRANTED;
    }

    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (status === PermissionStatus.GRANTED) {
      await this.setupAndroidChannel();
    }

    return status;
  }

  private async setupAndroidChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  async getExpoPushToken(): Promise<PushTokenResult> {
    const permissionStatus = await this.requestPermissions();

    if (permissionStatus !== PermissionStatus.GRANTED) {
      const error = NotificationClientError.fromPermissionStatus(permissionStatus);
      if (error) throw error;
      throw NotificationClientError.permissionDenied();
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

    if (!projectId) {
      throw NotificationClientError.projectIdNotFound();
    }

    try {
      const tokenData: ExpoPushToken = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      // DeviceIdService를 통해 deviceId 가져오기
      const deviceId = await this._deviceIdService.getOrCreateDeviceId();

      return {
        token: tokenData.data,
        deviceId,
      };
    } catch (error) {
      throw NotificationClientError.tokenRegistrationFailed(
        error instanceof Error ? error : undefined,
      );
    }
  }
}
```

### 7.2 알림 클릭 시 자동 읽음 처리

서버는 개별 알림 읽음 처리 API를 제공합니다: `PATCH /notifications/:id/read`

#### 서버 지원 현황

```typescript
// apps/api/src/modules/notification/notification.service.ts:284-304
async markAsRead(userId: string, notificationId: number): Promise<void> {
  const notification = await this.notificationRepository.findById(notificationId);

  if (!notification) {
    throw new NotFoundException('Notification not found');
  }

  if (notification.userId !== userId) {
    throw new ForbiddenException('Cannot mark other user notification as read');
  }

  // 이미 읽은 경우 스킵
  if (notification.isRead) {
    return;
  }

  await this.notificationRepository.markAsRead(notificationId);
  this.logger.debug(`Notification marked as read: id=${notificationId}`);
}
```

#### 클라이언트 구현: useNotificationObserver 개선

```typescript
// apps/mobile/src/features/notification/presentations/hooks/use-notification-observer.ts
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import type {
  Notification,
  NotificationResponse,
  NotificationBehavior,
} from 'expo-notifications';
import { useDI } from '@src/bootstrap/providers/di-provider';
import { useQueryClient } from '@tanstack/react-query';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';

const FOREGROUND_NOTIFICATION_BEHAVIOR: NotificationBehavior = {
  shouldPlaySound: true,
  shouldSetBadge: true,
  shouldShowBanner: true,
  shouldShowList: true,
};

Notifications.setNotificationHandler({
  handleNotification: async () => FOREGROUND_NOTIFICATION_BEHAVIOR,
});

export function useNotificationObserver() {
  const { notificationService } = useDI();
  const queryClient = useQueryClient();
  
  // 중복 처리 방지용 Set
  const processedNotificationIds = useRef<Set<number>>(new Set());

  // 알림 읽음 처리 + 캐시 무효화
  const markNotificationAsRead = async (notificationId: number | undefined) => {
    if (!notificationId) return;
    
    // 이미 처리된 알림 스킵
    if (processedNotificationIds.current.has(notificationId)) {
      return;
    }
    processedNotificationIds.current.add(notificationId);

    try {
      await notificationService.markAsRead(notificationId);
      
      // 캐시 무효화로 목록 및 unreadCount 갱신
      await queryClient.invalidateQueries({
        queryKey: NOTIFICATION_QUERY_KEYS.all,
      });
      
      console.log(`[Notification] Marked as read: id=${notificationId}`);
    } catch (error) {
      console.error('[Notification] Failed to mark as read:', error);
      // 실패해도 네비게이션은 진행
    }
  };

  const handleNotificationResponse = async (notification: Notification) => {
    const data = notification.request.content.data;

    // 알림 ID가 있으면 읽음 처리
    const notificationId = data.notificationId as number | undefined;
    await markNotificationAsRead(notificationId);

    // Internal link: route 필드로 앱 내 화면 이동
    if (data.route && typeof data.route === 'string') {
      router.push(data.route as any);
      return;
    }

    // External link: metadata.externalUrl로 외부 URL 열기
    if (data.metadata?.externalUrl && typeof data.metadata.externalUrl === 'string') {
      Linking.openURL(data.metadata.externalUrl);
      return;
    }
  };

  useEffect(() => {
    // 앱이 종료된 상태에서 알림 클릭으로 열린 경우
    const lastResponse: NotificationResponse | null =
      Notifications.getLastNotificationResponse();

    if (lastResponse?.notification) {
      handleNotificationResponse(lastResponse.notification);
    }

    // 앱 실행 중 알림 클릭
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response: NotificationResponse) => {
        handleNotificationResponse(response.notification);
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);
}
```

#### 서버에서 notificationId 전달 확인

```typescript
// apps/api/src/modules/notification/providers/expo-push.provider.ts
// Expo 푸시 메시지 생성 시 data에 notificationId 포함
const message: ExpoPushMessage = {
  to: token,
  sound: 'default',
  title,
  body,
  data: {
    notificationId,  // ✅ 클라이언트에서 읽음 처리에 사용
    route,
    metadata,
  },
};
```

#### NotificationService에 markAsRead 추가 확인

```typescript
// apps/mobile/src/features/notification/services/notification.service.ts
export class NotificationService {
  // ... 기존 코드 ...

  async markAsRead(notificationId: number): Promise<void> {
    await this._repository.markAsRead(notificationId);
  }
}
```

### 7.3 앱 아이콘 뱃지 관리

앱 아이콘에 표시되는 뱃지 숫자를 관리합니다. iOS와 Android에서 동작 방식이 다릅니다.

#### 플랫폼별 뱃지 동작

| 플랫폼 | 지원 | 동작 방식 |
|--------|------|----------|
| iOS | ✅ 완전 지원 | 앱 아이콘에 빨간 숫자 뱃지 표시 |
| Android | ⚠️ 제한적 | 런처에 따라 다름 (일부 런처만 지원) |

#### 서버 지원 현황

```typescript
// apps/api/src/modules/notification/providers/expo-push.provider.ts:186
private buildMessage(payload: PushPayload): ExpoPushMessage {
  return {
    to: payload.token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    badge: payload.badge,  // ✅ 서버에서 뱃지 숫자 전달 가능
    sound: payload.sound ?? "default",
    // ...
  };
}
```

#### 클라이언트 구현: BadgeService

```typescript
// apps/mobile/src/features/notification/services/badge.service.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export class BadgeService {
  /**
   * 현재 뱃지 숫자 조회
   */
  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  }

  /**
   * 뱃지 숫자 설정
   * @param count - 설정할 숫자 (0이면 뱃지 제거)
   */
  async setBadgeCount(count: number): Promise<boolean> {
    return Notifications.setBadgeCountAsync(count);
  }

  /**
   * 뱃지 제거 (숫자를 0으로 설정)
   */
  async clearBadge(): Promise<boolean> {
    return Notifications.setBadgeCountAsync(0);
  }

  /**
   * 읽지 않은 알림 수로 뱃지 동기화
   */
  async syncBadgeWithUnreadCount(unreadCount: number): Promise<void> {
    // iOS에서만 의미있는 동작
    if (Platform.OS === 'ios') {
      await this.setBadgeCount(unreadCount);
    }
  }
}
```

#### NotificationService에 뱃지 관리 통합

```typescript
// apps/mobile/src/features/notification/services/notification.service.ts
import type { BadgeService } from './badge.service';

export class NotificationService {
  constructor(
    private readonly _repository: NotificationRepository,
    private readonly _pushTokenService: PushTokenService,
    private readonly _badgeService: BadgeService,  // DI로 주입
  ) {}

  // ... 기존 메서드들 ...

  /**
   * 읽지 않은 알림 수 조회 + 뱃지 동기화
   */
  async getUnreadCount(): Promise<number> {
    const { unreadCount } = await this._repository.getUnreadCount();
    
    // 뱃지 숫자 동기화
    await this._badgeService.syncBadgeWithUnreadCount(unreadCount);
    
    return unreadCount;
  }

  /**
   * 알림 읽음 처리 + 뱃지 갱신
   */
  async markAsRead(notificationId: number): Promise<void> {
    await this._repository.markAsRead(notificationId);
    
    // 뱃지 숫자 갱신
    const { unreadCount } = await this._repository.getUnreadCount();
    await this._badgeService.syncBadgeWithUnreadCount(unreadCount);
  }

  /**
   * 모든 알림 읽음 처리 + 뱃지 제거
   */
  async markAllAsRead(): Promise<void> {
    await this._repository.markAllAsRead();
    
    // 뱃지 제거
    await this._badgeService.clearBadge();
  }

  /**
   * 뱃지 직접 제거 (앱 열 때 등)
   */
  async clearBadge(): Promise<void> {
    await this._badgeService.clearBadge();
  }
}
```

#### useBadge Hook

```typescript
// apps/mobile/src/features/notification/presentations/hooks/use-badge.ts
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useDI } from '@src/bootstrap/providers/di-provider';
import { useQuery } from '@tanstack/react-query';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';

export function useBadge() {
  const { notificationService } = useDI();

  // 읽지 않은 알림 수 조회 (뱃지 자동 동기화됨)
  const { data: unreadCount = 0, refetch } = useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount(),
    queryFn: () => notificationService.getUnreadCount(),
    staleTime: 30 * 1000, // 30초
  });

  // 앱이 포그라운드로 돌아올 때 뱃지 갱신
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refetch();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [refetch]);

  return {
    unreadCount,
    refetch,
  };
}
```

#### Root Layout에서 뱃지 관리

```typescript
// apps/mobile/app/_layout.tsx
import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { useAuth } from '@src/features/auth/presentations/hooks/use-auth';
import { useNotificationObserver } from '@src/features/notification/presentations/hooks/use-notification-observer';
import { useRegisterPushToken } from '@src/features/notification/presentations/hooks/use-register-push-token';
import { useBadge } from '@src/features/notification/presentations/hooks/use-badge';
import { useDI } from '@src/bootstrap/providers/di-provider';

export default function RootLayout() {
  const { isAuthenticated } = useAuth();
  const { notificationService } = useDI();
  const registerPushToken = useRegisterPushToken();
  
  // 전역 알림 리스너
  useNotificationObserver();
  
  // 뱃지 자동 관리 (포그라운드 복귀 시 갱신)
  useBadge();

  useEffect(() => {
    if (isAuthenticated) {
      registerPushToken.mutate();
      
      // 앱 시작 시 뱃지 동기화
      notificationService.getUnreadCount();
    } else {
      // 로그아웃 시 뱃지 제거
      notificationService.clearBadge();
    }
  }, [isAuthenticated]);

  return <Slot />;
}
```

#### 뱃지 관리 시나리오

| 시나리오 | 동작 |
|---------|------|
| 푸시 알림 수신 | 서버에서 `badge` 필드로 숫자 전달 → iOS가 자동 표시 |
| 알림 목록 열기 | `getUnreadCount()` 호출 → 뱃지 동기화 |
| 알림 클릭 (읽음) | `markAsRead()` 호출 → 뱃지 숫자 갱신 |
| 모두 읽음 처리 | `markAllAsRead()` 호출 → 뱃지 제거 (0) |
| 앱 포그라운드 진입 | `useBadge` 훅이 자동으로 `refetch()` |
| 로그아웃 | `clearBadge()` 호출 → 뱃지 제거 |

#### 서버에서 뱃지 숫자 포함하여 발송 (선택)

서버에서 푸시 발송 시 읽지 않은 알림 수를 뱃지로 포함할 수 있습니다:

```typescript
// apps/api/src/modules/notification/notification.service.ts (선택적 개선)
async createAndSend(input: CreateNotificationInput): Promise<Notification> {
  const notification = await this.notificationRepository.create(input);

  if (await this.shouldSendPush(input.userId, input.type)) {
    // 읽지 않은 알림 수 조회
    const unreadCount = await this.notificationRepository.getUnreadCount(input.userId);
    
    await this.pushProvider.send({
      token: pushToken.token,
      title: input.title,
      body: input.body,
      badge: unreadCount,  // 뱃지 숫자 포함
      data: {
        notificationId: notification.id,
        route: input.route,
        metadata: input.metadata,
      },
    });
  }

  return notification;
}
```

### 7.4 구현 시 주의사항

1. **deviceId 전략:**
   - iOS: `identifierForVendor`는 앱 재설치 시 변경될 수 있음 → SecureStore로 영구 저장
   - Android: `androidId`는 기기 초기화 전까지 유지
   - SecureStore 실패 시 fallback으로 랜덤 UUID 생성

2. **읽음 처리:**
   - `processedNotificationIds` Set으로 중복 호출 방지
   - 읽음 처리 실패해도 네비게이션은 정상 진행
   - `queryClient.invalidateQueries`로 목록/unreadCount 캐시 갱신

3. **서버 데이터 확인:**
   - 푸시 메시지 `data`에 `notificationId` 포함되어야 함
   - 서버 ExpoPushProvider에서 이미 포함하고 있음 ✅

4. **뱃지 관리:**
   - iOS에서만 의미있는 동작 (Android는 런처 의존)
   - 서버 발송 시 `badge` 필드 포함하면 iOS가 자동 표시
   - 클라이언트에서 `setBadgeCountAsync()`로 직접 제어 가능
   - 앱 포그라운드 진입 시 뱃지 동기화 권장

---

## 구현 체크리스트

**API 서버 (완료):**
- [x] 토큰 등록/해제 API
- [x] 알림 목록 조회 API
- [x] 푸시 발송 로직 (ExpoPushProvider)
- [x] 이벤트 리스너 연동
- [x] 사용자 설정 기반 필터링
- [x] 야간 푸시 필터링
- [x] 배치 발송 지원
- [x] deviceId 기반 unique constraint (userId + deviceId)
- [x] 개별 알림 읽음 처리 API (PATCH /notifications/:id/read)

**모바일 앱 (구현 필요):**
- [ ] Notification Feature 디렉토리 생성
- [ ] NotificationClientError 구현 (expo-notifications 타입 활용)
- [ ] PushTokenService 구현 (PermissionStatus, ExpoPushToken 활용)
- [ ] DeviceIdService 구현 (SecureStore 기반 영구 ID)
- [ ] NotificationService 구현
- [ ] NotificationRepository 구현
- [ ] BadgeService 구현 (뱃지 숫자 관리)
- [ ] useNotificationObserver 훅 구현 (Notification, NotificationResponse 활용)
- [ ] useNotificationReceived 훅 구현
- [ ] useRegisterPushToken 훅 구현
- [ ] useNotificationPermission 훅 구현
- [ ] useBadge 훅 구현 (뱃지 자동 동기화)
- [ ] DI Provider 등록
- [ ] Root Layout에 Observer 등록
- [ ] 로그인/로그아웃 연동
- [ ] 알림 클릭 시 자동 읽음 처리
- [ ] 뱃지 자동 동기화 (포그라운드 진입 시)
- [ ] 알림 목록 UI 구현 (선택)

---

**작성일:** 2026-01-31  
**버전:** 3.4.0  
**참고:** Expo SDK 54, expo-notifications v0.32.16 기준

**변경 이력:**
- v3.4.0: DeviceIdRepository 추가로 DI 패턴 일관성 확보 (Auth feature와 동일한 아키텍처)
- v3.3.0: 뱃지 관리 기능 추가 (BadgeService, useBadge)
- v3.2.0: deviceId 생성 전략 개선, 알림 클릭 시 자동 읽음 처리 추가
