# Aido PRD (Product Requirements Document)

**문서 버전**: v1.0  
**최종 수정일**: 2026-01-18  
**작성자**: Product Team  
**상태**: Draft

---

## 1. 개요

### 1.1 제품 소개

**Aido**는 "친구와 함께하는 AI 기반 할 일 관리 앱"입니다.

개인의 할 일 관리를 넘어 친구들과 서로의 일정을 공유하고, 서로 독촉(Nudge)하며 동기부여를 주고받는 소셜 생산성 플랫폼입니다.

### 1.2 핵심 가치

| 가치 | 설명 |
|------|------|
| **개인 생산성** | 할 일을 체계적으로 관리하고 완료율을 추적 |
| **소셜 동기부여** | 친구의 할 일을 확인하고 서로 응원/독촉 |
| **성취감** | 일일/주간 완료 배지로 성취감 제공 |
| **접근성** | 모바일 우선, 언제 어디서나 간편하게 |

### 1.3 타겟 사용자

| 세그먼트 | 특징 | 니즈 |
|----------|------|------|
| **대학생** | 과제, 시험, 모임 관리 | 친구들과 함께 공부 동기부여 |
| **사회초년생** | 업무와 개인 생활 밸런스 | 효율적인 일정 관리 |
| **자기계발러** | 습관 형성, 목표 달성 | 꾸준함을 위한 소셜 압력 |

---

## 2. 기능 명세

### 2.1 인증 시스템

#### 2.1.1 회원가입

**이메일 회원가입**

| 항목 | 스펙 |
|------|------|
| 이메일 | 표준 이메일 형식, 중복 불가 |
| 비밀번호 | 8자 이상, 영문+숫자 조합 필수 |
| 인증 | 6자리 인증 코드 이메일 발송 (10분 유효) |
| 시도 제한 | 인증 코드 최대 5회 시도 |

**소셜 회원가입/로그인**

| 제공자 | 지원 플랫폼 | 비고 |
|--------|------------|------|
| Apple | iOS, Web | 시스템 생체인증 다이얼로그 |
| Google | iOS, Android, Web | OAuth 2.0 |
| Kakao | iOS, Android, Web | OAuth 2.0 |
| Naver | iOS, Android, Web | OAuth 2.0 |

**계정 연동 정책**
- Apple (신뢰된 제공자): 동일 이메일 자동 연동
- 기타 제공자: 이메일 충돌 시 사용자 선택

#### 2.1.2 로그인

| 기능 | 설명 |
|------|------|
| 토큰 방식 | JWT (Access Token 15분 + Refresh Token 7일) |
| Token Rotation | 갱신 시마다 새 토큰 쌍 발급, 이전 토큰 즉시 무효화 |
| 재사용 감지 | 탈취된 토큰 사용 시 전체 세션 강제 로그아웃 |
| 계정 잠금 | 5회 로그인 실패 시 15분 잠금 |

#### 2.1.3 세션 관리

| 기능 | 설명 |
|------|------|
| 활성 세션 조회 | 모든 로그인 기기 목록 확인 |
| 원격 로그아웃 | 특정 기기 세션 종료 |
| 전체 로그아웃 | 모든 기기에서 동시 로그아웃 |

#### 2.1.4 비밀번호 관리

| 기능 | 설명 |
|------|------|
| 비밀번호 찾기 | 이메일로 재설정 코드 발송 (10분 유효) |
| 비밀번호 변경 | 로그인 상태에서 현재 비밀번호 확인 후 변경 |

---

### 2.2 Todo 관리

#### 2.2.1 Todo 속성

| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| title | String | ✓ | 할 일 제목 (1-200자) |
| content | String | - | 상세 내용 (최대 5,000자) |
| color | String | - | 색상 코드 (#RRGGBB 형식) |
| startDate | Date | ✓ | 시작 날짜 |
| endDate | Date | - | 종료 날짜 (startDate 이후) |
| scheduledTime | Time | - | 예정 시간 |
| isAllDay | Boolean | - | 종일 일정 여부 |
| visibility | Enum | - | PUBLIC / PRIVATE (기본: PRIVATE) |
| completed | Boolean | - | 완료 상태 |
| completedAt | DateTime | - | 완료 시각 (자동 기록) |

#### 2.2.2 Todo CRUD

| 기능 | 설명 |
|------|------|
| 생성 | 필수 필드 입력 후 생성, 기본값 자동 적용 |
| 조회 (목록) | 커서 기반 페이지네이션, 날짜/완료 상태 필터 |
| 조회 (상세) | 본인 Todo만 조회 가능 |
| 수정 | 부분 수정 지원 (제목, 내용, 색상, 일정, 공개범위) |
| 삭제 | Hard Delete (복구 불가) |

#### 2.2.3 완료 처리

| 동작 | 설명 |
|------|------|
| 완료 토글 | completed 상태 변경 |
| 완료 시각 | completed=true 시 completedAt 자동 기록 |
| 일일 완료 연동 | 당일 모든 Todo 완료 시 배지 획득 |

#### 2.2.4 공개 범위

| 값 | 설명 |
|-----|------|
| PRIVATE | 본인만 조회 가능 (기본값) |
| PUBLIC | 맞팔 친구가 조회 가능 |

---

### 2.3 친구 시스템

#### 2.3.1 친구 요청 플로우

```
┌─────────────────────────────────────────────────────┐
│                    친구 요청 상태                     │
└─────────────────────────────────────────────────────┘

[요청 보내기]
A → B: POST /follows/:userId
├─ 상태: PENDING (대기)
└─ B에게 알림 발송

[요청 수락]
B: PATCH /follows/:userId/accept
├─ A→B: ACCEPTED
├─ B→A: ACCEPTED (자동 생성)
└─ 양방향 친구 관계 성립

[요청 거절]
B: PATCH /follows/:userId/reject
└─ 요청 삭제

[자동 수락]
A → B: 요청 보냄 (PENDING)
B → A: 요청 보냄 (상호 요청)
├─ A→B: ACCEPTED (자동)
├─ B→A: ACCEPTED (자동)
└─ 양방향 친구 관계 성립
```

#### 2.3.2 친구 관리

| 기능 | 설명 |
|------|------|
| 친구 목록 | 맞팔 상태인 친구 목록 조회 |
| 받은 요청 | 나에게 요청 보낸 사용자 목록 |
| 보낸 요청 | 내가 요청 보낸 사용자 목록 |
| 친구 삭제 | 양방향 관계 동시 삭제 |
| 요청 철회 | 보낸 요청 취소 |

#### 2.3.3 친구 Todo 조회

| 조건 | 설명 |
|------|------|
| 권한 | 맞팔 친구만 조회 가능 |
| 범위 | PUBLIC 상태 Todo만 노출 |
| 페이지네이션 | 커서 기반 |

---

### 2.4 일일 완료 (Daily Completion)

#### 2.4.1 개념

하루 동안의 모든 Todo를 완료하면 "물고기" 배지를 획득하는 성취 시스템입니다.

#### 2.4.2 로직

| 조건 | 설명 |
|------|------|
| 기준 날짜 | 해당 일자 (startDate 기준) |
| 달성 조건 | 당일 Todo 개수 > 0 AND 모두 완료 |
| 기록 | totalTodos, completedTodos 저장 |
| 배지 | 100% 달성 시 획득 |

---

### 2.5 Nudge (독촉/응원) - 개발 예정

#### 2.5.1 개념

친구의 미완료 Todo에 독촉 또는 응원 메시지를 보내는 기능입니다.

#### 2.5.2 제한 정책

| 구독 상태 | 일일 제한 |
|----------|----------|
| FREE | 3회/일 |
| ACTIVE | 무제한 |

#### 2.5.3 쿨다운

| 조건 | 시간 |
|------|------|
| 같은 Todo 재독촉 | 24시간 |

---

### 2.6 알림 시스템

#### 2.6.1 알림 유형

| 유형 | 설명 | 액션 |
|------|------|------|
| FOLLOW_NEW | 새 친구 요청 | 요청 확인 화면 이동 |
| FOLLOW_ACCEPTED | 친구 수락됨 | 친구 프로필 이동 |
| NUDGE_RECEIVED | 독촉 받음 | 해당 Todo 이동 |
| DAILY_COMPLETE | 일일 완료 달성 | 배지 화면 이동 |
| SYSTEM | 시스템 공지 | URL 또는 없음 |

#### 2.6.2 보관 정책

| 항목 | 기간 |
|------|------|
| 인앱 알림 | 90일 |
| 푸시 알림 | 실시간 발송 |

---

## 3. 데이터 모델

### 3.1 핵심 엔티티

```
┌─────────────────────────────────────────────────────┐
│                     User (사용자)                    │
├─────────────────────────────────────────────────────┤
│ id           : CUID (고유 ID)                       │
│ email        : String (고유)                        │
│ userTag      : String (8자 영숫자, 검색용)            │
│ passwordHash : String (Argon2id)                   │
│ status       : ACTIVE / LOCKED / SUSPENDED /       │
│                PENDING_VERIFY                       │
│ subscriptionStatus: FREE / ACTIVE / EXPIRED /      │
│                     CANCELLED                       │
└─────────────────────────────────────────────────────┘
         │
         ├── UserProfile (이름, 프로필 사진)
         ├── UserPreference (푸시 알림 설정)
         ├── UserConsent (약관 동의)
         └── Account (OAuth 계정 연동)

┌─────────────────────────────────────────────────────┐
│                     Todo (할 일)                     │
├─────────────────────────────────────────────────────┤
│ id           : CUID                                │
│ userId       : FK → User                           │
│ title        : String (1-200자)                    │
│ content      : String (0-5000자)                   │
│ color        : String (#RRGGBB)                    │
│ startDate    : Date                                │
│ endDate      : Date                                │
│ scheduledTime: Time                                │
│ isAllDay     : Boolean                             │
│ visibility   : PUBLIC / PRIVATE                    │
│ completed    : Boolean                             │
│ completedAt  : DateTime                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                   Follow (친구 관계)                  │
├─────────────────────────────────────────────────────┤
│ id           : CUID                                │
│ followerId   : FK → User (요청자)                   │
│ followingId  : FK → User (대상자)                   │
│ status       : PENDING / ACCEPTED                  │
└─────────────────────────────────────────────────────┘
```

### 3.2 전체 테이블 목록

| 도메인 | 테이블 | 용도 |
|--------|--------|------|
| **사용자** | User | 기본 계정 정보 |
| | UserProfile | 프로필 (이름, 사진) |
| | UserPreference | 설정 (푸시 알림) |
| | UserConsent | 약관 동의 |
| | Account | OAuth 연동 |
| **인증** | Session | 로그인 세션 |
| | LoginAttempt | 로그인 시도 기록 |
| | SecurityLog | 보안 이벤트 |
| | Verification | 인증 코드 |
| | OAuthState | OAuth 상태 |
| **Todo** | Todo | 할 일 |
| | Follow | 친구 관계 |
| | Nudge | 독촉/응원 |
| | DailyCompletion | 일일 완료 |
| **알림** | Notification | 인앱 알림 |
| | PushToken | 푸시 토큰 |

---

## 4. API 명세

### 4.1 엔드포인트 요약

| 도메인 | 엔드포인트 수 | 인증 필요 |
|--------|:------------:|:--------:|
| Auth | 22개 | 일부 |
| Todo | 11개 | 전체 |
| Follow | 7개 | 전체 |
| Daily Completion | 2개 | 전체 |
| Health | 1개 | 불필요 |
| **합계** | **43개** | - |

### 4.2 인증 API

| 메서드 | 엔드포인트 | 설명 | 인증 |
|--------|-----------|------|:----:|
| POST | /auth/register | 회원가입 | - |
| POST | /auth/verify-email | 이메일 인증 | - |
| POST | /auth/resend-verification | 인증 코드 재발송 | - |
| POST | /auth/login | 로그인 | - |
| POST | /auth/logout | 로그아웃 | ✓ |
| POST | /auth/logout-all | 전체 로그아웃 | ✓ |
| POST | /auth/refresh | 토큰 갱신 | - |
| POST | /auth/forgot-password | 비밀번호 찾기 | - |
| POST | /auth/reset-password | 비밀번호 재설정 | - |
| PATCH | /auth/password | 비밀번호 변경 | ✓ |
| GET | /auth/me | 내 정보 조회 | ✓ |
| PATCH | /auth/profile | 프로필 수정 | ✓ |
| GET | /auth/sessions | 세션 목록 | ✓ |
| DELETE | /auth/sessions/:sessionId | 세션 종료 | ✓ |
| POST | /auth/exchange | OAuth 코드 교환 | - |
| POST | /auth/apple/callback | Apple 로그인 | - |
| POST | /auth/google/callback | Google 로그인 | - |
| POST | /auth/kakao/callback | Kakao 로그인 | - |
| POST | /auth/naver/callback | Naver 로그인 | - |
| GET | /auth/kakao/start | Kakao 웹 OAuth | - |
| GET | /auth/google/start | Google 웹 OAuth | - |
| GET | /auth/naver/start | Naver 웹 OAuth | - |

### 4.3 Todo API

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | /todos | Todo 생성 |
| GET | /todos | Todo 목록 조회 |
| GET | /todos/:id | Todo 상세 조회 |
| PATCH | /todos/:id | Todo 수정 |
| PATCH | /todos/:id/complete | 완료 상태 토글 |
| PATCH | /todos/:id/visibility | 공개 범위 변경 |
| PATCH | /todos/:id/color | 색상 변경 |
| PATCH | /todos/:id/schedule | 일정 변경 |
| PATCH | /todos/:id/content | 제목/내용 수정 |
| DELETE | /todos/:id | Todo 삭제 |
| GET | /todos/friends/:userId | 친구 Todo 조회 |

### 4.4 Follow API

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | /follows/:userId | 친구 요청 보내기 |
| PATCH | /follows/:userId/accept | 친구 요청 수락 |
| PATCH | /follows/:userId/reject | 친구 요청 거절 |
| DELETE | /follows/:userId | 친구 삭제/요청 철회 |
| GET | /follows/friends | 친구 목록 |
| GET | /follows/requests/received | 받은 요청 |
| GET | /follows/requests/sent | 보낸 요청 |

### 4.5 Daily Completion API

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | /daily-completion | 일일 완료 조회 |
| POST | /daily-completion | 일일 완료 기록 |

---

## 5. 에러 코드

### 5.1 에러 코드 체계

```
[도메인]_[번호]

SYS_0001-0099     : 시스템/공통
AUTH_0101-0108    : 인증/토큰
SOCIAL_0201-0206  : 소셜 로그인 공통
KAKAO_0301-0308   : 카카오
APPLE_0351-0357   : 애플
GOOGLE_0401-0406  : 구글
NAVER_0451-0456   : 네이버
EMAIL_0501-0508   : 이메일 인증
USER_0601-0610    : 사용자/계정
SESSION_0701-0704 : 세션
VERIFY_0751-0754  : 인증 코드
TODO_0801         : Todo
FOLLOW_0901-0908  : 친구/팔로우
```

### 5.2 주요 에러 코드 및 클라이언트 대응

| 코드 | HTTP | 메시지 | 클라이언트 대응 |
|------|:----:|--------|----------------|
| SYS_0001 | 500 | 서버 내부 오류 | 재시도 또는 고객센터 문의 안내 |
| SYS_0002 | 400 | 잘못된 파라미터 | 입력값 검증 후 재시도 |
| AUTH_0104 | 401 | 유효하지 않은 리프레시 토큰 | 재로그인 유도 |
| AUTH_0105 | 401 | 리프레시 토큰 만료 | 재로그인 유도 |
| AUTH_0107 | 401 | 인증이 필요합니다 | 로그인 화면 이동 |
| SESSION_0704 | 401 | 토큰 재사용 감지됨 | 보안 알림 + 재로그인 |
| SOCIAL_0202 | 401 | 소셜 토큰 유효하지 않음 | 소셜 로그인 재시도 |
| EMAIL_0501 | 409 | 이미 가입된 이메일 | 로그인 또는 다른 이메일 사용 |
| EMAIL_0502 | 400 | 잘못된 인증 코드 | 코드 재입력 안내 |
| EMAIL_0504 | 400 | 만료된 인증 코드 | 재발송 안내 |
| EMAIL_0505 | 400 | 인증 코드 시도 횟수 초과 | 재발송 후 새 코드 사용 |
| USER_0602 | 400 | 이메일/비밀번호 불일치 | 재입력 요청 |
| USER_0605 | 429 | 계정 잠금 (5회 실패) | 15분 대기 안내 |
| USER_0608 | 400 | 이메일 미인증 | 인증 화면 이동 |
| TODO_0801 | 404 | Todo를 찾을 수 없음 | 목록 새로고침 |
| FOLLOW_0901 | 409 | 이미 친구 요청 보낸 상태 | 취소 후 재시도 안내 |
| FOLLOW_0902 | 409 | 이미 친구 관계 | 친구 목록 확인 안내 |
| FOLLOW_0903 | 404 | 받은 친구 요청이 없음 | 목록 새로고침 |
| FOLLOW_0906 | 403 | 친구가 아닌 사용자의 투두 조회 불가 | 친구 추가 안내 |

---

## 6. 보안 요구사항

### 6.1 인증/인가

| 항목 | 스펙 |
|------|------|
| Access Token | JWT, 15분 유효, Authorization Bearer |
| Refresh Token | JWT, 7일 유효, Token Rotation 적용 |
| 비밀번호 해싱 | Argon2id (OWASP 권장 설정) |
| 계정 잠금 | 5회 실패 시 15분 잠금 |

### 6.2 토큰 보안

| 항목 | 설명 |
|------|------|
| Token Rotation | 갱신마다 새 토큰 쌍 발급 |
| 재사용 감지 | 이전 토큰 사용 시 전체 세션 무효화 |
| Device Fingerprint | User-Agent + IP 해시로 세션 검증 |

### 6.3 OAuth 보안

| 항목 | 설명 |
|------|------|
| CSRF 방지 | state 파라미터 검증 |
| PKCE | code_verifier로 코드 탈취 방지 |
| 토큰 검증 | 모든 소셜 토큰 서명 검증 |

### 6.4 데이터 보호

| 항목 | 설명 |
|------|------|
| HTTPS | 모든 통신 암호화 필수 |
| Soft Delete | 사용자 데이터 삭제 이력 보관 |
| 민감정보 | Expo Secure Store (모바일) |

---

## 7. 기술 스택

### 7.1 Backend (apps/api)

| 항목 | 기술 |
|------|------|
| Framework | NestJS 11 |
| Database | PostgreSQL + Prisma 7 |
| Authentication | JWT (jsonwebtoken) |
| Validation | Zod + nestjs-zod |
| Documentation | Swagger/OpenAPI |
| Logger | Pino |
| Testing | Jest, Testcontainers |

### 7.2 Mobile (apps/mobile)

| 항목 | 기술 |
|------|------|
| Framework | Expo 54, React Native 0.81 |
| UI Framework | React 19.1 |
| Routing | Expo Router 6.0 |
| State | TanStack React Query 5 |
| Form | React Hook Form 7 |
| UI Library | HeroUI Native, Uniwind |
| Styling | Tailwind CSS 4 |
| Animation | React Native Reanimated 4 |
| Storage | Expo Secure Store, SQLite |
| Push | Expo Notifications |

### 7.3 Shared (packages/)

| 패키지 | 용도 |
|--------|------|
| @aido/validators | Zod 스키마 (DTO) |
| @aido/errors | 에러 코드 정의 |
| @aido/utils | 공유 유틸리티 |

---

## 8. 비기능 요구사항

### 8.1 성능

| 항목 | 목표 |
|------|------|
| API 응답 시간 | p95 < 500ms |
| 목록 조회 | 커서 기반 페이지네이션 |
| 동시 접속 | 1,000명 이상 |

### 8.2 가용성

| 항목 | 목표 |
|------|------|
| Uptime | 99.5% |
| 장애 복구 | RTO 4시간, RPO 1시간 |

### 8.3 확장성

| 항목 | 전략 |
|------|------|
| 수평 확장 | Stateless API 설계 |
| 데이터베이스 | 읽기 복제본 (향후) |

---

## 9. 릴리즈 로드맵

### Phase 1: MVP (현재)

| 기능 | 상태 |
|------|:----:|
| 이메일 회원가입/로그인 | ✅ |
| 소셜 로그인 (Apple, Google, Kakao, Naver) | ✅ |
| Token Rotation + 재사용 감지 | ✅ |
| 세션 관리 | ✅ |
| Todo CRUD | ✅ |
| Todo 완료 처리 | ✅ |
| 친구 요청/수락/거절 | ✅ |
| 친구 Todo 조회 | ✅ |
| 일일 완료 배지 | ✅ |

### Phase 2: Growth (예정)

| 기능 | 우선순위 |
|------|:--------:|
| Nudge (독촉/응원) | 높음 |
| 푸시 알림 연동 | 높음 |
| 반복 Todo | 중간 |
| 주간 달성 배지 | 중간 |
| 친구 검색 (이메일, userTag) | 중간 |
| 친구 차단/해제 | 낮음 |

### Phase 3: Scale (예정)

| 기능 | 우선순위 |
|------|:--------:|
| 구독 결제 (RevenueCat) | 높음 |
| 오프라인 동기화 | 높음 |
| AI 추천 (Todo 분류, 시간 제안) | 중간 |
| 친구 추천 알고리즘 | 중간 |
| 그룹 Todo (팀 협업) | 낮음 |

---

## 10. 부록

### 10.1 용어 정의

| 용어 | 정의 |
|------|------|
| Todo | 사용자가 관리하는 할 일 항목 |
| Nudge | 친구에게 보내는 독촉/응원 메시지 |
| 맞팔 | 양방향 친구 관계 (A↔B 모두 ACCEPTED) |
| Token Rotation | 토큰 갱신 시 새 쌍 발급 후 이전 토큰 무효화 |
| userTag | 8자리 고유 식별자 (예: ABC12DEF) |

### 10.2 참고 문서

| 문서 | 위치 |
|------|------|
| API 아키텍처 가이드 | apps/api/.claude/ |
| 모바일 컴포넌트 가이드 | apps/mobile/.claude/ |
| Zod 스키마 | packages/validators/src/ |
| 에러 코드 정의 | packages/errors/src/ |
| Prisma 스키마 | apps/api/prisma/schema.prisma |

### 10.3 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.0 | 2026-01-18 | 초안 작성 |

---

**문서 끝**
