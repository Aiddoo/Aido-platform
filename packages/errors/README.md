# @aido/errors

API/Mobile에서 일관된 에러 처리를 위한 에러 코드 패키지.

## 설치

```json
{
  "dependencies": {
    "@aido/errors": "workspace:*"
  }
}
```

## 사용법

### 에러 코드 조회

```typescript
import { ErrorCode, getError } from '@aido/errors';

const error = getError(ErrorCode.AUTH_0101);
// { code: 'AUTH_0101', message: '인증이 필요합니다', httpStatus: 401 }
```

### 에러 응답 생성

```typescript
import { createErrorResponse, ErrorCode } from '@aido/errors';

const response = createErrorResponse(ErrorCode.TODO_0801);
// { error: { code: 'TODO_0801', message: '할 일을 찾을 수 없어요' } }
```

### 도메인별 에러 조회

```typescript
import { getErrorsByDomain } from '@aido/errors';

const authErrors = getErrorsByDomain('AUTH');
```

## 에러 코드 범위

| 도메인 | 코드 범위 | 설명 |
|--------|----------|------|
| SYS | 0001-0099 | 시스템/공통 |
| AUTH | 0100-0199 | 인증/JWT |
| SOCIAL | 0200-0299 | 소셜 로그인 공통 |
| KAKAO | 0300-0349 | 카카오 |
| APPLE | 0350-0399 | 애플 |
| GOOGLE | 0400-0449 | 구글 |
| NAVER | 0450-0499 | 네이버 |
| EMAIL | 0500-0549 | 이메일 인증 |
| USER | 0600-0699 | 사용자/계정 |
| SESSION | 0700-0749 | 세션 |
| TODO | 0800-0849 | Todo |
| TODO_CATEGORY | 0850-0899 | Todo 카테고리 |
| FOLLOW | 0900-0999 | 친구/팔로우 |
| NOTIFICATION | 1000-1099 | 알림/푸시 |
| NUDGE | 1100-1199 | 독촉 |
| CHEER | 1200-1299 | 응원 |
| AI | 1300-1399 | AI 서비스 |

## 구조

```
src/
├── errors.ts      # 에러 코드 정의
├── http-status.ts # HTTP 상태 코드
├── types.ts       # 타입 정의
├── utils.ts       # 유틸리티 함수
└── index.ts       # export
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm build` | 빌드 |
| `pnpm typecheck` | 타입 검사 |
