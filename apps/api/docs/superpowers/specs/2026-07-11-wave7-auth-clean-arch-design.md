# Wave 7 — auth 모듈 클린아키텍처 이관 설계

> **날짜**: 2026-07-11 · **브랜치**: `refactor/clean-arch-migration` · **모듈**: `apps/api/src/auth` (8,824 LOC / 58파일)
> **상태**: 설계 승인 완료(포트 통합 레벨 A · 스테이지드 5커밋), 구현 계획 대기

---

## 1. 목표와 절대 제약

apps/api의 마지막 미이관 모듈이자 최대 모듈인 `auth`를 나머지 20개 모듈과 동일한 todo 표준 클린아키텍처(domain/application/infrastructure/presentation + Facade + 포트/어댑터)로 이관한다.

**사용자 핵심 요구**: 소셜로그인 4종(네이버·카카오·구글·애플)을 **하나의 통합 포트**(Payment 인터페이스 스타일 — 교체가능한 프로바이더 어댑터가 하나의 포트를 구현하고 레지스트리로 조회)로 추상화하고, 이메일 로그인까지 깔끔하게 정리한다.

**절대 불변(클라이언트 영향 zero)**:

- `test/e2e/__snapshots__/openapi-contract.e2e-spec.ts.snap` **diff 0** — 매 커밋 게이트.
- request/response 형태, **에러코드(@aido/errors)**, 상태코드, 시맨틱 동결. `BusinessExceptions`→`ApplicationException`/`DomainException` 변환 시 필터가 정규화하는 최종 errorCode + details가 byte-identical해야 함.
- 라우트 ~35개(아래 §7 인벤토리) 전부 경로·메서드·인증·throttle 불변.
- 전역 `APP_GUARD`(JwtAuthGuard) · `APP_INTERCEPTOR`(LastActiveInterceptor) 등록 순서·동작 불변(`app.module.ts:156,166`).
- 세션 회전/재사용 탐지, 락아웃, 30일 grace 소프트삭제, OAuth state CSRF, exchange-code 1회성, 토큰 재사용 tokenFamily 폐기 — 모든 보안 시맨틱 보존.

---

## 2. 통합 포트 설계 결정 (레벨 A — 승인됨)

Payment 비유의 올바른 해석: **교체가능한 외부 프로바이더는 한 포트로, 발급은 공유 레이어에서 합류.**

```
port OAuthIdentityProvider  (application/ports)
  registry: Map<AccountProvider, OAuthIdentityProvider>  (레지스트리 토큰 DI)
    ├─ GoogleOAuthAdapter   (web+mobile)   infrastructure/oauth/adapters
    ├─ KakaoOAuthAdapter    (web+mobile)
    ├─ NaverOAuthAdapter    (web+mobile)
    └─ AppleOAuthAdapter    (mobile-only)
  메서드: verifyToken · generateAuthUrl · exchangeCode · buildLoginOptions

PasswordCredentialVerifier  (이메일 전용, 별도 — OAuth 포트 미구현)
  lockout + argon2 verify + status/grace 판정

              ▼ 소셜·이메일 둘 다 수렴 ▼
IssueLoginUseCase(identity)     → 세션+토큰(SessionService) + 보안로그 + 로그인시도 + 프로필 → LoginResult
ProvisionUserUseCase(identity)  → 유저(status) + 프로필 + 동의 + 프리퍼런스 + 기본 카테고리
```

**근거**: 4개 OAuth 프로바이더는 "외부 신원을 검증한다"는 동일 op라 교체가능(=한 포트). 이메일/비밀번호는 다른 op(비밀번호 검증·락아웃)라 발급 레이어에서 합류한다. 이메일을 억지로 OAuth 포트에 끼우면 `authUrl`/`exchangeCode`/`verifyToken`이 null인 leaky 인터페이스가 됨(현재 Apple의 web-flow null 스멜과 동일). Payment=Stripe/PayPal은 같은 op라 한 포트, 이메일은 "스토어 크레딧" 같은 다른 op.

**현재 상태와의 차이**: 이미 `IOAuthProviderStrategy` + `Map<AccountProvider, strategy>`가 `OAuthService` 생성자 안에 배아 상태로 존재. 그러나 (a) 서비스 레이어에 하드코딩(`new`, DI 아님), (b) 어댑터가 raw `fetch()` + JSON 캐스트 + `BusinessExceptions`를 직접 수행 = 인프라 관심사 혼입. 이관은 이 전략을 **application 포트 + infrastructure 어댑터(DI 등록)**로 승격하고, `OAuthTokenVerifierService`(jose JWKS · google-auth-library · kakao/naver fetch)도 인프라 어댑터로 내린다.

---

## 3. 도메인 모델 (todo 표준 — 애그리게잇/VO/도메인서비스)

> 사용자 지침(⚑): "다른데도 싹다 Todo 처럼. 오버엔지니어링이라 생각하더라도. SOLID 준수." → 순수 함수는 domain/services/, 상태+행위는 애그리게잇/VO 클래스로.

**애그리게잇**:

- `User` — status 전이(PENDING_VERIFY→ACTIVE, LOCKED/SUSPENDED, 소프트삭제 deletedAt+30일 grace, restore), `markEmailVerified`, `planSoftDelete`/`planRestore`, grace-period 판정. 상태 검증 불변식(accountLocked/Suspended/Deleted)을 애그리게잇이 소유.
- `Account` — 크레덴셜(argon2 해시) + OAuth 링크 컬렉션. 불변식: **마지막 계정 unlink 금지**(cannotUnlinkLastAccount), 크레덴셜 중복 방지(credentialAccountAlreadyExists), provider별 링크 중복(`*AccountAlreadyLinked`).
- `Session` — 회전(rotate)·재사용 탐지(previousTokenHash + grace)·tokenFamily 폐기·tokenVersion 낙관적락(CAS). 만료/폐기 판정.
- `Verification` — 6자리 코드(SHA-256 해시), 시도횟수 브루트포스 방어, 재발송 쿨다운, 만료. 타입(EMAIL_VERIFY/PASSWORD_RESET/PASSWORD_SETUP).

**VO**: `Email`(정규화), `HashedPassword`(argon2 needsRehash 판정), `RefreshTokenHash`, `OAuthState`(CSRF + PKCE + mode), `ExchangeCode`(1회성).

**도메인 서비스(순수)**: `login-lockout`(30분/5회), `token-reuse-policy`(grace vs attack), `account-grace-period`(30일), `trusted-provider`(자동링크 판정 — 이메일 verified + TRUSTED_EMAIL_PROVIDERS), `redirect-uri-allowlist`(정규식 허용목록), `random-name`/`user-tag`(기존 utils → domain/services).

**주의**: 도메인 애그리게잇은 리스크가 큰 부분. 계약(에러코드) 보존이 최우선이므로, 애그리게잇이 던지는 불변식 위반은 기존 `BusinessExceptions.xxx()`와 **동일 errorCode**를 내는 `DomainException`으로 매핑. e2e(auth 81 케이스)로 행동 파리티 검증.

---

## 4. 애플리케이션 레이어

**Facades**(컨트롤러의 유일 주입 대상):

- `AuthFacade` — register/verifyEmail/resendVerification/login/logout/logoutAll/refresh/getCurrentUser/updateProfile/getActiveSessions/revokeSession/deleteAccount.
- `PasswordFacade` — forgot/reset/change/setup-code/setPassword.
- `OAuthFacade` — 4프로바이더 web start/callback + 4 mobile callback + link/unlink/getLinkedAccounts/exchange/link-with-code.

**포트**:

- `OAUTH_IDENTITY_PROVIDER_REGISTRY` — provider→어댑터 조회. `#getStrategy` 로직이 포트로.
- `USER_REPOSITORY`·`ACCOUNT_REPOSITORY`·`SESSION_REPOSITORY`·`VERIFICATION_REPOSITORY`·`LOGIN_ATTEMPT_REPOSITORY`·`SECURITY_LOG_REPOSITORY`·`OAUTH_STATE_REPOSITORY` — 저장소 포트(interface+Symbol).
- `TOKEN_SIGNER`(JWT)·`PASSWORD_HASHER`(argon2)·`EMAIL_SENDER`(기존 EmailFacade 위임)·`ADMIN_NOTIFIER`(AdminNotificationFacade 위임) — 벤더/크로스모듈 포트.
- 크로스모듈 소비용: `user-settings`/`ai` 등이 쓰는 `UserPreferenceRepository`/`UserConsentRepository`/`TodoCategoryRepository`는 **각 모듈 배럴/파사드 주입**으로 역전(이미 이관됨).

**Use-cases**(@Injectable, `execute(input)` — 무버스):

- 공유 수렴: `IssueLoginUseCase`(세션+토큰+보안로그+로그인시도+프로필→LoginResult) · `ProvisionUserUseCase`(유저+프로필+동의+프리퍼런스+기본카테고리). **이것이 email login ↔ social login의 중복 흡수 지점.**
- 이메일: `RegisterUseCase`·`VerifyEmailUseCase`·`LoginUseCase`·`RefreshTokensUseCase`·`LogoutUseCase`·`DeleteAccountUseCase` 등.
- OAuth: `SocialLoginUseCase`(mobile+web 수렴, `#handleSocialLogin` 승격) · `LinkAccountUseCase`·`UnlinkAccountUseCase`·`ExchangeCodeUseCase`.
- 비밀번호: `ForgotPasswordUseCase`·`ResetPasswordUseCase`·`ChangePasswordUseCase`·`SetPasswordUseCase`.

**세션 발급 공유 프리미티브 보존**: `SessionService.createSessionWithTokens`(세션 row + JWT 페어 + refresh 해시)는 이미 email/social 수렴점 — 그대로 유지하되 application/services로 이동, `SESSION_REPOSITORY`·`TOKEN_SIGNER` 포트 주입.

---

## 5. 인프라스트럭처

- **OAuth 어댑터**(`infrastructure/oauth/adapters/{google,kakao,naver,apple}.oauth-adapter.ts`): raw `fetch()` → 여기로. 벤더 JSON 캐스트는 `shared/infrastructure/http/readJson<T>`(weather 선례)로 격리. 설정은 `TypedConfigService` 주입. DI 등록 + 레지스트리 팩토리(`{provide: REGISTRY, useFactory: (g,k,n,a)=>new Map(...)}`).
- **토큰 검증 어댑터**(`infrastructure/oauth/verifier/`): jose JWKS(Apple)·google-auth-library(Google)·kakao/naver fetch. `VerifiedProfile` 반환. jose ESM 동적 import 유지.
- **저장소 어댑터**(`infrastructure/persistence/prisma-*.repository.ts`): 7종. **레거시 `tx?` + DatabaseService → CLS `TransactionHost.tx`로 전환**(다른 모듈 표준). `database.$transaction(tx=>...)` 호출부는 use-case에서 `UNIT_OF_WORK.run(...)`으로.
- **계정 purge**: `AccountPurgeJob`(cron `0 3 * * *` KST) + `AccountPurgeProcessor`(setter 순환 → 생성자 주입으로 제거, admin-notification/notification 선례). `ACCOUNT_PURGE_QUEUE` 상수 → infrastructure/queue로, 배럴 export(e2e·health 재배선).
- **가드/전략/인터셉터**: `JwtAuthGuard`·`JwtRefreshGuard`·`AdminGuard`, passport `JwtStrategy`·`JwtRefreshStrategy`, `LastActiveInterceptor` → presentation/infrastructure 적절 배치. 동작 불변.

---

## 6. 시더 트랜잭션 특이점 (⚠️ 계약 보존 핵심)

`register`·`#createSocialUser`가 유저 생성 시 **명시적 `database.$transaction(tx)`에 기본 카테고리 createMany + 동의 + 프리퍼런스를 함께 참여**시킴(CLS 아님, 원자성 필수). Wave 4a에서 이를 위해 레거시 `TodoCategoryRepository`(createMany 전용)를 배럴에 남겨둠. 이관 시:

- `ProvisionUserUseCase`가 `UNIT_OF_WORK.run`으로 CLS 트랜잭션 열고, 그 안에서 user-settings/todo-category **파사드의 CLS 경로**로 시딩 통합.
- 레거시 concrete `TodoCategoryRepository`(createMany)·`UserPreferenceRepository`·`UserConsentRepository` 배럴 잔재 삭제 — **이관의 마감 항목(7e)**.

---

## 7. 크로스모듈 & 배럴 공개 API

**auth 배럴이 유지해야 할 공개 표면**(현재 딥임포트 → 배럴/서브엔트리로 정리):

- `Public` 데코레이터 — app.controller, health, subscription controller(3).
- `CurrentUser` + `type CurrentUserPayload` — user-settings controller(런타임 1) + 스펙 타입 다수.
- `JwtAuthGuard`·`LastActiveInterceptor`·`AuthModule` — app.module 전역.
- **`UserRepository` — 오직 ai `prisma-ai-usage.repository.ts` 위임 어댑터 1곳** → auth `AuthFacade.findUser...` 또는 `USER_READER` 포트로 역전.

**경계 게이트 대응**: auth를 `CLEAN_MODULES`에 등록하면 외부 딥임포트(`@/auth/guards/...`, `@/auth/decorators/...`, `@/auth/interceptors/...`)가 rule#3 위반. → 이들을 **배럴 export**로 올리고 소비자 4곳 재배선. 전역 가드/인터셉터/데코레이터는 배럴 재수출로 app.module 변경 최소화(경로만).

---

## 8. 예외/계약 보존 전략

`BusinessExceptions`(770줄, ~40 팩토리) → `ApplicationException`/`DomainException` 변환. **각 변환은 동일 errorCode + details 필수**. 방식:

- errorCode별 1:1 매핑표 작성(invalidCredentials, accountLocked, emailNotVerified, socialTokenInvalid/Expired, cannotUnlinkLastAccount, *AccountAlreadyLinked, verificationCodeInvalid/MaxAttempts, accountDeletionPasswordRequired 등 전량).
- GlobalExceptionFilter가 이미 두 예외 계열을 동일 errorCode로 정규화 → HTTP 바디 불변.
- e2e auth 스위트(81) + integration(oauth/account-deletion/password 3종)로 행동 파리티 검증.

---

## 9. 스테이지드 커밋 계획 (매 커밋 green — 승인됨)

| 커밋               | 범위                                                                                                                                                                                               | green 게이트                                       | CLEAN_MODULES |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------- |
| **7a foundation**  | git mv로 4계층 스켈레톤 배치, 배럴 공개표면 정리(guards/decorators/interceptor/Public/CurrentUser), 외부 딥임포트 4곳 재배선, ai `UserRepository`→포트, ACCOUNT_PURGE_QUEUE 배럴. **로직 무변경**. | typecheck·lint·유닛·통합·e2e·**OpenAPI diff 0**    | 미등록        |
| **7b oauth port**  | `OAuthIdentityProvider` 포트 + 레지스트리 DI + 4 어댑터(fetch→infra, readJson 캐스트격리) + verifier 어댑터. OAuthService는 포트 소비로 전환.                                                      | ↑ + oauth 통합/e2e                                 | 미등록        |
| **7c convergence** | `IssueLoginUseCase`·`ProvisionUserUseCase` 추출, email `login`/`verifyEmail` ↔ social `#createSessionAndTokens` 중복 흡수, `#createSocialUser`↔`register` 유저생성 통합.                           | ↑ + auth/oauth e2e                                 | 미등록        |
| **7d domain+CLS**  | User/Account/Session/Verification 애그리게잇 + VO + 도메인서비스, 저장소 CLS 전환, `BusinessExceptions`→Application/DomainException(errorCode 매핑표). Facade/use-case 완성.                       | ↑ 전부                                             | 미등록        |
| **7e purge+마감**  | account-purge 어댑터화, 레거시 시더 배럴 잔재 삭제, **auth를 CLEAN_MODULES + no-cast TARGET_DIRS 등록**(코드 이미 clean), 문서 종합 개편(이중트랙→단일트랙), Waves 1-2 버스 소급 제거 검토.        | ↑ + **no-cast·boundaries ON** + 전체 유닛/통합/e2e | **등록**      |

각 커밋 전: `pnpm exec biome check --write src test` 선실행(프리커밋 훅 임포트 재정렬 대비). commitlint body-max-line-length 100자. Co-Authored-By: Claude Opus 4.8 (1M context).

---

## 10. 테스트 전략

- 레거시 service.spec → use-case spec 재작성(핸들러 동거). jest.mock은 vendor/native 경계에만([[feedback-di-tests-minimal-mocking]]).
- OAuth 어댑터: fetch 목은 벤더 경계라 허용. verifier(jose/google-auth-library)는 어댑터 spec에서 격리.
- integration: oauth/account-deletion/password 3종 포트 목으로 재배선.
- e2e: auth(81)·oauth·account-deletion·oauth 통합 무변경 동작 단언, import 경로만.
- **매 커밋 OpenAPI 스냅샷 diff 0**(전체 앱 부팅 = auth 와이어링 증명).

---

## 11. 리스크 & 오픈 항목

- **최대 리스크**: 예외 변환(§8) — errorCode 하나라도 어긋나면 클라 계약 파손. 매핑표 + e2e가 방어선.
- **시더 원자성**(§6) — CLS 전환 시 유저생성 트랜잭션에 카테고리 시딩이 같은 tx로 참여하는지 검증. 실패 시 유저 생성 롤백돼야 함.
- **낙관적 락**: Session tokenVersion CAS는 이미 존재(rotateToken) — 보존만.
- **auth account purge**: hardDelete cascade + onDelete:SetNull 보안로그 시맨틱 보존.
- **연기 후보**: version 컬럼 낙관적잠금 추가 확산(보류), lint:no-cast CI 연결(보류).
- **문서 마감**: architecture.md §1.4·api-conventions.md §9·CLAUDE.md 이중트랙→단일트랙, EventEmitter2 가이드.

---

## 관련 메모리

[[project-clean-arch-migration]] · [[feedback-clean-arch-module-rigor]] · [[feedback-di-tests-minimal-mocking]] · [[braces-always]] · [[feedback-no-biome-ignore]]
