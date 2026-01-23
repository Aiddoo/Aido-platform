# Aido Mobile App

Expo 기반 React Native 모바일 앱입니다. Clean Architecture + Ports & Adapters 패턴을 따릅니다.

---

## 기술 스택

| 분류 | 라이브러리 |
|------|-----------|
| 프레임워크 | Expo SDK, React Native |
| 라우팅 | Expo Router (파일 기반) |
| 상태관리 | TanStack Query v5 |
| HTTP | Ky |
| 검증 | Zod |
| UI | HeroUI Native, NativeWind |
| DI | React Context (수동 DI) |

---

## 아키텍처 레이어

```
┌─────────────────────────────────────────────────────────────┐
│  📱 Presentation Layer                                       │
│  ├── app/                  ← Expo Router 화면 (라우트)        │
│  └── presentations/        ← 컴포넌트, React Query 훅         │
├─────────────────────────────────────────────────────────────┤
│  🔧 Application Layer                                        │
│  └── services/             ← 비즈니스 로직 조합 + DTO 변환     │
├─────────────────────────────────────────────────────────────┤
│  📦 Domain Layer                                             │
│  ├── models/               ← 도메인 모델 + Zod 스키마 + Policy │
│  └── repositories/         ← Repository 인터페이스            │
├─────────────────────────────────────────────────────────────┤
│  🔌 Infrastructure Layer                                     │
│  ├── repositories/*.impl   ← Repository 구현체               │
│  └── shared/infra/         ← HTTP 클라이언트, Storage 구현     │
├─────────────────────────────────────────────────────────────┤
│  🎯 Core Layer                                               │
│  └── core/ports/           ← 외부 의존성 추상화 인터페이스       │
├─────────────────────────────────────────────────────────────┤
│  🚀 Bootstrap Layer                                          │
│  └── bootstrap/providers/  ← DI 컨테이너, 전역 Provider        │
└─────────────────────────────────────────────────────────────┘
```

---

## Auth Feature 전체 코드

### 디렉토리 구조

```
features/auth/
├── models/
│   └── auth.model.ts         # 도메인 모델 + Policy
├── services/
│   ├── auth.service.ts       # 비즈니스 로직
│   └── auth.mapper.ts        # DTO ↔ Domain 변환
├── repositories/
│   ├── auth.repository.ts    # 인터페이스
│   └── auth.repository.impl.ts # 구현체
└── presentations/
    ├── constants/
    │   └── auth-query-keys.constant.ts
    ├── queries/
    │   ├── exchange-code-mutation-options.ts
    │   ├── get-me-query-options.ts
    │   ├── logout-mutation-options.ts
    │   └── open-kakao-login-mutation-options.ts
    └── components/
        └── ProfileCard.tsx
```

---

### 1. Model Layer

```typescript
// models/auth.model.ts
import type { SubscriptionStatus } from '@aido/validators';
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  profileImage: z.string().nullable(),
  userTag: z.string(),
  subscriptionStatus: z.enum(['FREE', 'ACTIVE', 'EXPIRED', 'CANCELLED']),
  isSubscribed: z.boolean(),
  createdAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const AuthTokensSchema = z.object({
  userId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  userName: z.string().nullable(),
  userProfileImage: z.string().nullable(),
});

export type AuthTokens = z.infer<typeof AuthTokensSchema>;

// Policy (비즈니스 규칙)
const isSubscriptionActive = (status: SubscriptionStatus): boolean => status === 'ACTIVE';

export const AuthPolicy = {
  isSubscriptionActive,
};
```

---

### 2. Repository Layer

```typescript
// repositories/auth.repository.ts (인터페이스)
import type { AuthTokens, CurrentUser, ExchangeCodeInput } from '@aido/validators';

export interface AuthRepository {
  exchangeCode(request: ExchangeCodeInput): Promise<AuthTokens>;
  getCurrentUser(): Promise<CurrentUser>;
  logout(): Promise<void>;
  getKakaoAuthUrl(redirectUri: string): string;
}
```

```typescript
// repositories/auth.repository.impl.ts (구현체)
import {
  type AuthTokens,
  authTokensSchema,
  type CurrentUser,
  currentUserSchema,
  type ExchangeCodeInput,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { Storage } from '@src/core/ports/storage';
import { ENV } from '@src/shared/config/env';
import type { AuthRepository } from './auth.repository';

export class AuthRepositoryImpl implements AuthRepository {
  constructor(
    private readonly _publicHttpClient: HttpClient,
    private readonly _authHttpClient: HttpClient,
    private readonly _storage: Storage,
  ) {}

  async exchangeCode(request: ExchangeCodeInput): Promise<AuthTokens> {
    const { data } = await this._publicHttpClient.post<AuthTokens>('v1/auth/exchange', request);

    const result = authTokensSchema.safeParse(data);
    if (!result.success) {
      console.error('[AuthRepository] Invalid exchangeCode response:', result.error);
      throw new Error('Invalid API response format');
    }

    await Promise.all([
      this._storage.set('accessToken', result.data.accessToken),
      this._storage.set('refreshToken', result.data.refreshToken),
    ]);

    return result.data;
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const { data } = await this._authHttpClient.get<CurrentUser>('v1/auth/me');

    const result = currentUserSchema.safeParse(data);
    if (!result.success) {
      console.error('[AuthRepository] Invalid getCurrentUser response:', result.error);
      throw new Error('Invalid API response format');
    }

    return result.data;
  }

  async logout(): Promise<void> {
    await this._authHttpClient.post('v1/auth/logout');
    await Promise.all([
      this._storage.remove('accessToken'),
      this._storage.remove('refreshToken'),
    ]);
  }

  getKakaoAuthUrl(redirectUri: string): string {
    return `${ENV.API_URL}/v1/auth/kakao/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }
}
```

---

### 3. Service Layer

```typescript
// services/auth.service.ts
import type { ExchangeCodeInput } from '@aido/validators';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { AuthTokens, User } from '../models/auth.model';
import type { AuthRepository } from '../repositories/auth.repository';
import { toAuthTokens, toUser } from './auth.mapper';

export class AuthService {
  constructor(private readonly _authRepository: AuthRepository) {}

  openKakaoLogin = async (): Promise<string | null> => {
    const redirectUri = Linking.createURL('auth/kakao');
    const authUrl = this._authRepository.getKakaoAuthUrl(redirectUri);

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type !== 'success') {
      return null;
    }

    const { queryParams } = Linking.parse(result.url);
    const code = queryParams?.code;

    return typeof code === 'string' ? code : null;
  };

  exchangeCode = async (request: ExchangeCodeInput): Promise<AuthTokens> => {
    const dto = await this._authRepository.exchangeCode(request);
    return toAuthTokens(dto);
  };

  getCurrentUser = async (): Promise<User> => {
    const dto = await this._authRepository.getCurrentUser();
    return toUser(dto);
  };

  logout = async (): Promise<void> => {
    return this._authRepository.logout();
  };
}
```

```typescript
// services/auth.mapper.ts
import type { AuthTokens as AuthTokensDTO, CurrentUser } from '@aido/validators';
import { AuthPolicy, type AuthTokens, type User } from '../models/auth.model';

export const toUser = (dto: CurrentUser): User => ({
  id: dto.userId,
  email: dto.email,
  name: dto.name,
  profileImage: dto.profileImage,
  userTag: dto.userTag,
  subscriptionStatus: dto.subscriptionStatus,
  createdAt: new Date(dto.createdAt),
  // Policy를 통한 computed 속성
  isSubscribed: AuthPolicy.isSubscriptionActive(dto.subscriptionStatus),
});

export const toAuthTokens = (dto: AuthTokensDTO): AuthTokens => ({
  userId: dto.userId,
  accessToken: dto.accessToken,
  refreshToken: dto.refreshToken,
  userName: dto.name,
  userProfileImage: dto.profileImage,
});
```

---

### 4. Presentation Layer

```typescript
// presentations/constants/auth-query-keys.constant.ts
export const AUTH_QUERY_KEYS = {
  all: ['auth'] as const,
  me: () => [...AUTH_QUERY_KEYS.all, 'me'] as const,
} as const;
```

```typescript
// presentations/queries/get-me-query-options.ts
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { queryOptions } from '@tanstack/react-query';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export const getMeQueryOptions = () => {
  const authService = useAuthService();

  return queryOptions({
    queryKey: AUTH_QUERY_KEYS.me(),
    queryFn: () => authService.getCurrentUser(),
  });
};
```

```typescript
// presentations/queries/exchange-code-mutation-options.ts
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions } from '@tanstack/react-query';

export const exchangeCodeMutationOptions = () => {
  const authService = useAuthService();
  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: authService.exchangeCode,
    onSuccess: () => {
      setStatus('authenticated');
    },
  });
};
```

```typescript
// presentations/queries/open-kakao-login-mutation-options.ts
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions } from '@tanstack/react-query';

export const openKakaoLoginMutationOptions = () => {
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: () => authService.openKakaoLogin(),
  });
};
```

```typescript
// presentations/queries/logout-mutation-options.ts
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

export const logoutMutationOptions = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();
  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      setStatus('unauthenticated');
      queryClient.clear();
    },
  });
};
```

```tsx
// presentations/components/ProfileCard.tsx
import { HStack } from '@src/shared/ui/HStack/HStack';
import { H4 } from '@src/shared/ui/Text/Typography';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Avatar, SkeletonGroup } from 'heroui-native';
import { getMeQueryOptions } from '../queries/get-me-query-options';

const ProfileCardRoot = () => {
  const { data: user } = useSuspenseQuery(getMeQueryOptions());

  return (
    <HStack gap={12} align="center">
      <Avatar size="lg" alt={`${user.name ?? '사용자'} 프로필`}>
        <Avatar.Image source={require('@assets/images/icon.png')} />
      </Avatar>
      <H4>{user.name ?? '사용자'}</H4>
    </HStack>
  );
};

const ProfileCardLoading = () => {
  return (
    <SkeletonGroup isLoading isSkeletonOnly>
      <HStack gap={12} align="center">
        <SkeletonGroup.Item className="size-12 rounded-full" />
        <SkeletonGroup.Item className="h-5 w-24 rounded-md" />
      </HStack>
    </SkeletonGroup>
  );
};

export const ProfileCard = Object.assign(ProfileCardRoot, {
  Loading: ProfileCardLoading,
});
```

---

## 파일 네이밍 규칙

| 파일 유형 | 패턴 | 예시 |
|----------|------|------|
| 모델 | `{name}.model.ts` | `auth.model.ts` |
| 서비스 | `{name}.service.ts` | `auth.service.ts` |
| 매퍼 | `{name}.mapper.ts` | `auth.mapper.ts` |
| 리포지토리 인터페이스 | `{name}.repository.ts` | `auth.repository.ts` |
| 리포지토리 구현 | `{name}.repository.impl.ts` | `auth.repository.impl.ts` |
| Query Options | `{action}-query-options.ts` | `get-me-query-options.ts` |
| Mutation Options | `{action}-mutation-options.ts` | `logout-mutation-options.ts` |
| Query Keys | `{name}-query-keys.constant.ts` | `auth-query-keys.constant.ts` |

---

## 새 기능 추가 가이드

```
1. features/{name}/ 폴더 생성
2. models/{name}.model.ts - Zod 스키마 + 타입 + Policy
3. repositories/{name}.repository.ts - 인터페이스
4. repositories/{name}.repository.impl.ts - 구현체
5. services/{name}.service.ts - 비즈니스 로직
6. services/{name}.mapper.ts - DTO ↔ Domain 변환
7. presentations/constants/ - Query Keys
8. presentations/queries/ - React Query Options
9. presentations/components/ - Feature 전용 컴포넌트
10. bootstrap/providers/di-provider.tsx - DI 등록
11. app/ 하위에 라우트 추가
```
