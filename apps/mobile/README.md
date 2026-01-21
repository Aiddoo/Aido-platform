# @aido/mobile

> Aido 모바일 애플리케이션

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Expo](https://img.shields.io/badge/Expo-54.x-000020.svg)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 개요

Expo 54 기반의 크로스 플랫폼 모바일 앱입니다. Expo Router를 사용한 파일 기반 라우팅과 New Architecture를 지원합니다.

## 시작하기

```bash
# 개발 서버
pnpm dev

# iOS 시뮬레이터
pnpm ios

# Android 에뮬레이터
pnpm android
```

## 주요 명령어

| 명령어           | 설명               |
| ---------------- | ------------------ |
| `pnpm dev`       | Expo 개발 서버     |
| `pnpm ios`       | iOS 시뮬레이터     |
| `pnpm android`   | Android 에뮬레이터 |
| `pnpm build`     | 빌드               |
| `pnpm test`      | 테스트             |
| `pnpm lint`      | 린트               |
| `pnpm typecheck` | 타입 체크          |

---

## 아키텍처

### Expo Router 구조

파일 기반 라우팅을 사용합니다. `app/` 디렉토리의 파일 구조가 곧 URL 구조입니다.

```
app/
├── _layout.tsx      # 루트 레이아웃 (Stack/Tab 네비게이션)
├── index.tsx        # 홈 화면 (/)
├── (auth)/          # 인증 그룹 (URL에 미포함)
│   ├── _layout.tsx
│   ├── login.tsx    # /login
│   └── register.tsx # /register
├── (tabs)/          # 탭 네비게이션 그룹
│   ├── _layout.tsx  # Tab.Navigator 정의
│   ├── home.tsx     # /home
│   └── settings.tsx # /settings
└── [id].tsx         # 동적 라우트 (/123, /abc)
```

### 라우팅 패턴

| 패턴      | 파일                   | URL                 |
| --------- | ---------------------- | ------------------- |
| 정적      | `about.tsx`            | `/about`            |
| 동적      | `[id].tsx`             | `/123`              |
| 그룹      | `(auth)/login.tsx`     | `/login`            |
| 중첩      | `settings/profile.tsx` | `/settings/profile` |
| Catch-all | `[...missing].tsx`     | 404 처리            |

### 레이아웃 계층

```
┌─────────────────────────────────────────┐
│           _layout.tsx (Root)            │
│  ┌─────────────────────────────────────┐│
│  │     Stack.Navigator / Slot          ││
│  │  ┌─────────────────────────────────┐││
│  │  │    (tabs)/_layout.tsx           │││
│  │  │  ┌─────────────────────────────┐│││
│  │  │  │   Tab.Navigator             ││││
│  │  │  │   - home.tsx                ││││
│  │  │  │   - settings.tsx            ││││
│  │  │  └─────────────────────────────┘│││
│  │  └─────────────────────────────────┘││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

---

## 공유 패키지 사용

### @aido/validators

폼 검증에 Zod 스키마를 사용합니다:

```typescript
import { todoCreateSchema, type TodoCreate } from "@aido/validators";

// 폼 데이터 검증
const result = todoCreateSchema.safeParse(formData);

if (!result.success) {
  // Zod 에러 처리
  const errors = result.error.flatten().fieldErrors;
  setErrors(errors);
  return;
}

// 검증 통과
await api.createTodo(result.data);
```

### @aido/utils

유틸리티 함수 사용:

```typescript
import { debounce } from "@aido/utils";

// 검색 입력 디바운스
const debouncedSearch = debounce((query: string) => {
  fetchResults(query);
}, 300);

<TextInput onChangeText={debouncedSearch} />;
```

---

## 코드 패턴

### 화면 컴포넌트

```typescript
// app/todos/index.tsx
import { StyleSheet, Text, View, FlatList } from "react-native";
import { useEffect, useState } from "react";

export default function TodosScreen() {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const response = await fetch(`${API_URL}/todos`);
      const data = await response.json();
      setTodos(data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={todos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <TodoItem todo={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});
```

### 네비게이션

```typescript
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function TodoDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const handleEdit = () => {
    router.push(`/todos/${id}/edit`);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    // ...
  );
}
```

### 레이아웃 정의

```typescript
// app/_layout.tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "홈" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "상세" }} />
    </Stack>
  );
}
```

---

## 환경 설정

### 환경별 빌드

`app.config.ts`에서 환경에 따라 설정이 자동 변경됩니다:

| 환경        | Bundle ID                 | 앱 이름          | API URL              |
| ----------- | ------------------------- | ---------------- | -------------------- |
| development | `com.aido.mobile.dev`     | Aido Development | localhost:8080       |
| preview     | `com.aido.mobile.preview` | Aido Preview     | preview-api.aido.com |
| production  | `com.aido.mobile`         | Aido             | api.aido.com         |

### 환경 변수

`.env` 파일 (gitignore됨):

```env
# 개발 기본
EXPO_PUBLIC_API_URL=http://localhost:8080

# Android 실기기에서 개발 서버 접근 (PC IP로 교체)
# EXPO_PUBLIC_LOCAL_IP=192.168.0.10

# 프로덕션/프리뷰 예시
# EXPO_PUBLIC_API_URL=https://api.aido.kr
```

**접두사 규칙:**

- `EXPO_PUBLIC_*`: 클라이언트에서 접근 가능
- 그 외: 빌드 시에만 사용

### API 접근 설정

개발 환경에서 플랫폼별로 자동으로 올바른 localhost URL을 사용합니다:

| 플랫폼 | API URL | 설명 |
| --- | --- | --- |
| iOS 시뮬레이터 | `http://localhost:8080` | 호스트 머신의 localhost 직접 접근 |
| Android 에뮬레이터 | `http://10.0.2.2:8080` | 에뮬레이터에서 자동 매핑 |
| Android 실기기 | `http://192.168.x.x:8080` | `EXPO_PUBLIC_LOCAL_IP` 필요 |
| iOS 실기기 | `http://192.168.x.x:8080` | 동일 네트워크 IP 직접 입력 |

**실제 기기 테스트 시:**

```bash
# 1. 개발 머신의 로컬 IP 확인
ifconfig | grep "inet " | grep -v 127.0.0.1
# 예: 192.168.0.10

# 2. .env 파일에 설정
echo "EXPO_PUBLIC_LOCAL_IP=192.168.0.10" > .env

# 3. API 서버가 0.0.0.0에서 실행 중인지 확인
# 4. 기기와 개발 머신이 같은 WiFi에 연결되어 있는지 확인
```

**환경 변수 옵션:**

- `EXPO_PUBLIC_API_URL`: Production/Preview API URL (설정 시 우선 사용, prod는 `https://api.aido.kr` 권장)
- `EXPO_PUBLIC_DEV_PORT`: 개발 서버 포트 (기본값: 8080)
- `EXPO_PUBLIC_LOCAL_IP`: 실제 기기용 로컬 네트워크 IP (Android/iOS 공통)

---

## 빌드 & 배포

### EAS Build 프로필

| 프로필      | 용도        | 명령어                            |
| ----------- | ----------- | --------------------------------- |
| development | 개발용 빌드 | `eas build --profile development` |
| preview     | 테스터 배포 | `eas build --profile preview`     |
| production  | 스토어 배포 | `eas build --profile production`  |

### 빌드 명령어

```bash
# iOS 개발 빌드
eas build --profile development --platform ios

# Android 프리뷰 빌드
eas build --profile preview --platform android

# 전체 프로덕션 빌드
eas build --profile production --platform all
```

### 스토어 제출

```bash
# App Store
eas submit --platform ios

# Google Play
eas submit --platform android
```

---

## 테스트

### 테스트 실행

```bash
# 전체 테스트
pnpm test

# Watch 모드
pnpm test --watch

# 커버리지
pnpm test --coverage
```

### 테스트 작성

```typescript
// __tests__/HomeScreen.test.tsx
import { render, screen } from "@testing-library/react-native";
import HomeScreen from "../app/index";

describe("HomeScreen", () => {
  it("renders home text", () => {
    render(<HomeScreen />);
    expect(screen.getByText("홈 페이지")).toBeTruthy();
  });
});
```

---

## 프로젝트 구조

```
apps/mobile/
├── app/                    # Expo Router 페이지
│   ├── _layout.tsx         # 루트 레이아웃
│   ├── index.tsx           # 홈 화면
│   └── [id].tsx            # 동적 라우트
│
├── assets/                 # 정적 리소스
│   └── images/
│       ├── icon.png        # 앱 아이콘
│       ├── adaptive-icon.png
│       ├── splash-icon.png
│       └── favicon.png
│
├── __tests__/              # 테스트 파일
│
├── app.config.ts           # Expo 설정 (환경별)
├── eas.json                # EAS 빌드 설정
├── package.json
└── tsconfig.json
```

---

## 주요 의존성

| 패키지           | 버전      | 용도             |
| ---------------- | --------- | ---------------- |
| expo             | ~54.0     | Expo SDK         |
| expo-router      | ~6.0      | 파일 기반 라우팅 |
| react-native     | 0.81      | 네이티브 UI      |
| @aido/validators | workspace | Zod 스키마       |
| @aido/utils      | workspace | 유틸리티 함수    |

---

## 새 화면 추가 체크리스트

1. [ ] `app/` 디렉토리에 파일 생성
2. [ ] 필요시 `_layout.tsx`에 Screen 옵션 추가
3. [ ] 스타일 정의 (StyleSheet.create)
4. [ ] 공유 스키마 사용 (@aido/validators)
5. [ ] 테스트 작성 (`__tests__/`)

---

## 변경 이력

### v1.0.0 (2025-01-13)

- 초기 릴리즈
- Expo 54 + React Native 0.81 기반
- Expo Router 파일 기반 라우팅
- New Architecture 활성화
- 푸시 알림 (expo-notifications)
- 생체 인증 (expo-local-authentication)
- 오프라인 DB (expo-sqlite)
- 캘린더 동기화 (expo-calendar)
- EAS Build 프로필 구성 (development, preview, production)
