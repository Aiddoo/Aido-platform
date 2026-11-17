# identity 용어집

가입·로그인·세션·인증 코드·로그인 수단·탈퇴·설정·동의 기능을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

사용자가 누구이고 어떻게 로그인하는지, 그 사람의 설정과 동의를 소유한다. slice마다 Aggregate Root가 하나이고 slice 이름은 Aggregate 이름의 kebab 복수형이다. 형제 slice와 다른 Context는 각 slice의 `*.public.ts`로만 읽는다. 토큰·서명 키 운영 규칙은 [보안](../security.md)에 있다.

| slice              | Aggregate        | 테이블                         | 소유                                                |
| ------------------ | ---------------- | ------------------------------ | --------------------------------------------------- |
| `sessions`         | `Session`        | `Session`                      | 로그인 세션과 refresh 토큰 회전                     |
| `verifications`    | `Verification`   | `Verification`                 | 메일로 보낸 인증 코드                               |
| `oauth-states`     | `OAuthState`     | `OAuthState`                   | 웹 소셜 로그인 state와 앱에 넘길 교환 코드          |
| `linked-accounts`  | `LinkedAccounts` | `Account`                      | 한 사용자의 로그인 수단과 비밀번호                  |
| `users`            | `User`           | `User`·`UserProfile`           | 계정 상태·가입·탈퇴·복구·프로필·활동 기록·성장 요약 |
| `user-preferences` | `UserPreference` | `UserPreference`·`UserConsent` | 설정·연속 완료·약관·광고·AI 데이터 처리 동의        |

| 용어               | 코드                                                 | 뜻                                                                                                                                                                           |
| ------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 로그인 수단        | `AccountProvider`, `ACCOUNT_PROVIDERS`               | `CREDENTIAL`(이메일·비밀번호)·`APPLE`·`GOOGLE`·`KAKAO`·`NAVER`. DB enum 순서는 계약과 달라 `ACCOUNT_PROVIDERS_IN_DB_ORDER`다                                                 |
| 이메일             | `Email`(VO)                                          | 계약 `emailSchema`와 같은 형식, 255자 이하. 틀리면 `SYS_0002`. 정규화(소문자)는 계약이 이미 했다                                                                             |
| 합성 이메일        | `<provider>_<id>@social.aido.kr`                     | 이메일을 주지 않는 소셜 계정의 가입 이메일. `Email` VO를 거치지 않는다                                                                                                       |
| 보안 로그          | `SECURITY_EVENT`, `SecurityLog`                      | 가입·로그인 성공/실패·토큰 갱신·폐기·연결·탈퇴·복구를 사용자별로 남기는 감사 기록                                                                                            |
| 사용자 잠금        | `UserMutationLockPort.lockById`                      | User 행 잠금. 로그인 수단·비밀번호를 바꾸는 요청과 다른 Context의 차감·보상이 같은 잠금을 잡는다. 사용자가 없으면 `false`                                                    |
| AI 사용량 칸       | `UserAiUsageCounterPort`                             | 출시 앱 `/v1/ai/usage`·`/me`가 읽는 `User.aiUsageCount`·`aiUsageResetAt`. access 원장이 사용자 잠금 안에서 읽고 조건부로 바꾸는 유일한 문이다                                |
| 사용자 요약        | `UserBriefReaderPort`, `UserBriefReadModel`          | social이 사람을 확인·표시하는 문. id 묶음으로 태그·이름·프로필 이미지·탈퇴 대기를 한 번에 읽고, 활성 여부·태그 조회·가입 신원(로그인 수단)을 준다                            |
| 사용자 검색        | `UserSearchReaderPort`, `UserExclusionCondition`     | ACTIVE이고 탈퇴 대기가 아닌 사람을 Aido ID·이름으로 찾는다. 순위는 태그 정확·태그 앞부분·이름 앞부분·부분 일치다. 뺄 사람은 부르는 쪽 조건이다                               |
| 사용자 조건        | `undeletedUserCondition`, `userTagContainsCondition` | 다른 Context가 사람 id 칸으로 페이지를 고를 때 붙이는 SQL 조건. 사용자 테이블을 직접 읽지 않게 identity가 연다                                                               |
| 활동 시각 조각     | `userLastActivity`                                   | 다른 Context가 사람 id 칸으로 마지막 활동 시각을 한 SQL에 붙이는 하위 질의. 탈퇴 대기도 담는다                                                                               |
| 받는 사람 조각     | `userRecipients`, `userProfileNameOf`                | 다른 Context가 자기 조건(권한·설정·할 일)으로 받는 사람을 한 SQL에 고를 때 쓰는 사용자 테이블·칸과 프로필 이름 lateral 하위 질의. 탈퇴 대기는 `undeleted`로 부르는 쪽이 뺀다 |
| 구독 projection 칸 | `UserSubscriptionProjectionPort`                     | 출시 앱 `/me`·권한 SQL이 읽는 `User.subscriptionStatus`·`subscriptionExpiresAt`. billing이 사용자 잠금 안에서 쓰고, 만료 웹훅을 잃은 사용자를 고르는 유일한 문이다           |

## sessions

| 용어             | 코드                                                                          | 뜻                                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 로그인 세션      | `Session`(Aggregate), `SessionId`, `CreateSessionUseCase`                     | 기기 하나의 로그인. refresh 토큰 hash·직전 hash·토큰 묶음(`tokenFamily`)·버전·기기 지문·IP·User-Agent를 가진다. 만든 쪽 트랜잭션에 함께 커밋한다                       |
| 로그인           | `IssueLoginUseCase`, `LoginWithPasswordUseCase`, `LoginWithOAuthTokenUseCase` | 이메일·소셜 로그인이 모두 `IssueLoginUseCase`로 모여 세션과 토큰 한 쌍을 만들고 로그인 성공·보안 로그를 남긴다. 모바일 SDK 토큰은 `LoginWithMobileOAuthTokenUseCase`다 |
| 로그인 실패 잠금 | `LOGIN_ATTEMPT`, `LOGIN_FAILURE_REASON`, `LoginAttempt`                       | 같은 이메일의 비밀번호 로그인이 15분 안에 5번째 실패하면 `USER_0607`. 사용자 상태(`LOCKED`)를 바꾸지 않는다. 계정 유무와 상관없이 실패는 `USER_0602`다                 |
| 세션 확인        | `AuthenticateSessionUseCase`, `JwtAuthGuard`                                  | 서명이 맞는 access 토큰의 세션이 살아 있는지 30초 캐시로 본다. 세션이 유효해도 잠금 `USER_0607`, 정지·탈퇴 대기 `USER_0605`로 거절한다                                 |
| 토큰 갱신(회전)  | `RefreshTokensUseCase`, `Session.rotate`                                      | 갱신마다 새 refresh 토큰을 주고 버전을 1 올린다. 지금 hash를 직전 hash로 남긴다. 역할은 DB 값으로 다시 발급해 강등된 ADMIN이 남지 않는다                               |
| 재시도 grace     | `isRetryWithin`, `TOKEN_REUSE_GRACE_PERIOD_MS`                                | 직전 토큰이 마지막 사용 뒤 10초 안에 다시 오면 응답을 못 받은 앱의 재시도로 보고 한 번 더 회전한다                                                                     |
| 토큰 재사용      | `wasPreviouslyIssued`, `revokeByTokenFamily`                                  | grace를 넘긴 직전 토큰은 유출로 본다. 같은 묶음 세션을 폐기하고 `SESSION_0704`, 경보 `identity.session.refresh-token.reused`                                           |
| 폐기             | `Session.revoke`, `revokeAllByUserId`(저장소), `REVOKE_REASON`                | 세션을 끊는다. 사유(감사용)와 함께 세션 캐시를 비우고 그 세션의 푸시 기기를 놓는다                                                                                     |
| 로그아웃         | `LogoutUseCase`, `LogoutAllUseCase`                                           | 지금 세션, 또는 내 폐기 전 세션 모두를 폐기한다. 모두 로그아웃은 끊은 수를 준다                                                                                        |
| 세션 종료        | `RevokeSessionUseCase`                                                        | 세션 목록에서 고른 세션을 끊는다. 내 세션이 아니거나 없으면 `SESSION_0701`                                                                                             |
| 세션 목록        | `ListActiveSessionsUseCase`                                                   | 폐기 전·만료 전 세션을 최근 사용 순으로 준다. 기기 이름·종류는 저장하지 않아 `null`, 현재 세션 표시는 늘 `false`다(출시 계약)                                          |
| 기기 지문        | `deviceFingerprint`                                                           | 비밀번호 로그인의 `deviceName`, 없으면 User-Agent. 64자로 자르고 신뢰 판단에 쓰지 않는다                                                                               |

회전은 `Session.rotate`, 폐기는 `Session.revoke`(이미 폐기면 `false`, 처음 폐기 시각·사유를 둔다)다. `save`는 폐기 전 행만 바꾸고 회전은 읽을 때의 버전일 때만 쓴다. 경합에 지면 `false`다. 만료 시각과 같은 순간부터 만료다(인증 코드·OAuth state·탈퇴 유예와 같은 `isExpiredAt` 규칙).

| 상태    | 행동                                                    | 다음                            | 다시·금지                                                              |
| ------- | ------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| 없음    | `Session.create`(`CreateSessionUseCase`)                | valid, 버전 1                   | —                                                                      |
| valid   | `rotate` → `save`(`RefreshTokensUseCase`)               | valid, 버전 +1, 만료 다시 계산  | 버전이 바뀌었거나 폐기면 `save`가 `false` → `SESSION_0702`             |
| valid   | grace 밖 직전 토큰 갱신                                 | revoked(`TOKEN_REUSE_DETECTED`) | `SESSION_0704`                                                         |
| valid   | `revoke`(로그아웃·세션 종료)                            | revoked                         | 이미 폐기면 `false`. 로그아웃 `SESSION_0702`, 세션 종료는 같은 응답    |
| valid   | `revokeAllByUserId`(모두 로그아웃·비밀번호 재설정·탈퇴) | revoked                         | 폐기 전 세션만. 비밀번호 변경은 지금 세션을 남긴다(`PASSWORD_CHANGED`) |
| valid   | 만료 시각 지남                                          | expired                         | 갱신·인증 `SESSION_0702`                                               |
| revoked | 갱신·인증                                               | —                               | `SESSION_0703`                                                         |

## verifications

| 용어             | 코드                                                             | 뜻                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 인증 코드        | `Verification`(Aggregate), `VerificationId`, `VERIFICATION_CODE` | 메일로 보낸 6자리 코드 한 건. 원문은 저장하지 않고 hash만 둔다. 발급 10분 뒤 만료, 5번 틀리면 소진                                           |
| 코드 종류        | `VerificationType`, `VERIFICATION_TYPE`                          | `EMAIL_VERIFY`(가입 메일 인증)·`PASSWORD_RESET`(비밀번호 재설정)·`PASSWORD_SETUP`(소셜 계정에 비밀번호 추가)                                 |
| 코드 발급        | `IssueVerificationCodeUseCase`, `SendVerificationCodeUseCase`    | 같은 종류의 남은 코드를 지금 만료시키고 새 코드를 만든다. 메일은 커밋 뒤 발송 큐에 담고, 담지 못하면 예외 없이 다시 보내게 안내한다          |
| 다시 보내기 대기 | `resendCooldownStartsAt`, `resendCooldownRemainingSeconds`       | 같은 종류를 60초 안에 다시 요청하면 `VERIFY_0753`. details `remainingSeconds`는 1초 밑도 1초로 올려 앱 타이머가 0에서 멈추지 않게 한다       |
| 코드 확인        | `ConsumeVerificationCodeUseCase`, `judgeVerificationAttempt`     | 쓸 수 있는 코드일 때만 hash를 비교한다. 거절 사유는 missing·used·expired·exhausted·mismatch이고 소진만 `VERIFY_0754`, 나머지는 `VERIFY_0751` |
| 틀린 시도        | `recordFailedAttempt`, `incrementAttempts`                       | 틀리면 시도를 1 올린다. 저장은 호출자 트랜잭션 밖이라 롤백돼도 남는다                                                                        |
| 이메일 인증      | `VerifyEmailUseCase`, `ResendVerificationUseCase`                | `EMAIL_VERIFY` 코드로 PENDING_VERIFY 사용자를 ACTIVE로 바꾼다. 없는 이메일 `EMAIL_0502`, 이미 인증 `USER_0604`, 탈퇴 `USER_0606`             |

| 상태         | 행동                                                  | 다음                       | 다시·금지                                       |
| ------------ | ----------------------------------------------------- | -------------------------- | ----------------------------------------------- |
| 없음         | `Verification.create`(`IssueVerificationCodeUseCase`) | valid, 시도 0, 발급 + 10분 | 같은 종류 60초 안이면 만들지 않고 `VERIFY_0753` |
| valid        | 같은 종류 새 발급(`invalidateAllByUserIdAndType`)     | expired(만료 = 지금)       | —                                               |
| valid        | 틀린 코드(`incrementAttempts`)                        | valid, 시도 +1             | `VERIFY_0751`. 시도 5부터 exhausted             |
| valid        | 맞는 코드(`consume` → 저장소 조건부 소비)             | used                       | 경합에 지면 `false` → `VERIFY_0751`             |
| used·expired | 확인                                                  | —                          | `VERIFY_0751`                                   |
| exhausted    | 확인                                                  | —                          | `VERIFY_0754`. 맞는 코드여도 시도로 세지 않는다 |

`validityAt`은 사용 → 만료 → 소진 순으로 판단하고 만료 시각과 같은 순간부터 만료다. `consume`·`recordFailedAttempt`는 쓸 수 있는 코드에만 `true`이고, 저장소의 조건부 소비·원자적 증가가 경합을 막는다.

## oauth-states

| 용어           | 코드                                                                          | 뜻                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 웹 소셜 로그인 | `StartOAuthAuthorizationUseCase`, `CompleteOAuthAuthorizationUseCase`         | 시스템 브라우저로 공급자 로그인을 거쳐 앱 딥링크로 돌아오는 흐름. 시작이 state를 만들고 콜백이 공급자 코드를 토큰으로 바꾼다                  |
| state          | `OAuthState`(Aggregate), `OAuthStateId`, `OAUTH_STATE_EXPIRY_MINUTES`         | 콜백 위조를 막는 일회용 값과 그 결과. 10분 기다린다. 지원하지 않는 공급자는 `SOCIAL_0204`                                                     |
| 목적           | `OAuthMode`, `OAUTH_MODES`                                                    | `login`(로그인)·`link`(로그인한 계정에 소셜 연결). 연결은 시작한 사용자(`initiatingUserId`)만 교환한다                                        |
| 교환 코드      | `exchangeCode`, `ExchangeOAuthCodeUseCase`, `LinkOAuthAccountWithCodeUseCase` | 콜백이 딥링크에 붙이는 일회용 코드. 앱이 한 번 바꿔 토큰(login)이나 연결(link)을 받는다. 없거나 쓸 수 없으면 `USER_0602`                      |
| 로그인 교환    | `loginExchange`                                                               | 저장한 access·refresh 토큰과 userId가 모두 있을 때만 준다. 토큰은 암호화해 두고 교환하면 지운다. 새 가입이면 교환 때 가입 알림을 한 번 보낸다 |
| 앱 복귀 주소   | `GetOAuthRedirectUriUseCase`, `DEFAULT_OAUTH_REDIRECT_URI`                    | 콜백이 돌아갈 딥링크. 저장한 주소가 비면 출시 앱이 등록한 기본 scheme이다                                                                     |
| 옛 앱 연결     | `canLinkFor`                                                                  | 1.15.0까지의 앱은 시작한 사용자를 보내지 않는다. 비어 있으면 누구의 연결 교환도 받는다                                                        |

| 상태              | 행동                                                   | 다음                      | 다시·금지                                                   |
| ----------------- | ------------------------------------------------------ | ------------------------- | ----------------------------------------------------------- |
| 없음              | 저장소 `create`(`StartOAuthAuthorizationUseCase`)      | valid, 시작 + 10분        | —                                                           |
| valid             | 콜백 `saveExchangeData`(login)·`saveLinkingData`(link) | valid, 교환 코드          | state가 없거나 만료면 `USER_0602`                           |
| valid, 교환 코드  | `consume(now)` 뒤 저장소 `consumeExchangeCode`         | exchanged, 저장 토큰 지움 | 이미 교환·만료·다른 사용자의 연결이면 `false` → `USER_0602` |
| exchanged·expired | 교환                                                   | —                         | `USER_0602`                                                 |

`validityAt`은 `valid`·`expired`·`exchanged`이고 교환이 만료보다 먼저다. 만료 시각과 같은 순간부터 만료다.

## linked-accounts

| 용어             | 코드                                                     | 뜻                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 로그인 수단 묶음 | `LinkedAccounts`(Aggregate), `ListLinkedAccountsUseCase` | 한 사용자의 이메일·소셜 계정(`Account` 행) 모음. id는 `UserId`이고 마지막 하나는 끊을 수 없다                                                                                    |
| 소셜 연결        | `LinkOAuthAccountUseCase`, `LinkOAuthIdentityUseCase`    | 로그인한 계정에 공급자 계정을 더한다. 공급자 계정이 이미 누군가에게 연결됐으면 `KAKAO_0306`·`APPLE_0355`·`GOOGLE_0405`·`NAVER_0455`                                              |
| 자동 연결        | `TRUSTED_EMAIL_PROVIDERS`                                | GOOGLE·APPLE 로그인 이메일이 기존 계정과 같으면 그 계정에 바로 잇는다. KAKAO·NAVER는 `SOCIAL_0206`으로 기존 계정에서 먼저 연결하게 한다                                          |
| 연결 해제        | `UnlinkOAuthAccountUseCase`, `unlink(provider)`          | 사용자 잠금 아래에서 하나를 빼고 뺀 계정을 돌려준다. 없는 공급자 `USER_0603`, 마지막 하나 `USER_0610`                                                                            |
| 비밀번호         | `ARGON2_CONFIG`, `needsRehash`                           | `CREDENTIAL` 계정에 argon2id hash로 둔다. 로그인 성공 뒤 설정이 바뀐 hash는 응답과 따로, 그사이 바뀌지 않았을 때만 다시 만든다(`updatePasswordIfUnchanged`)                      |
| 비밀번호 변경    | `ChangePasswordUseCase`                                  | 지금 비밀번호를 확인하고 지금 세션을 뺀 세션을 폐기한다. 소셜 전용 `USER_0613`, 틀리면 `USER_0602`                                                                               |
| 비밀번호 재설정  | `RequestPasswordResetUseCase`, `ResetPasswordUseCase`    | `PASSWORD_RESET` 코드로 새 비밀번호를 정하고 모든 세션을 폐기한다. 없는·탈퇴한 이메일도 같은 응답이고 60초 대기(`PasswordResetCooldownPort`)도 이메일마다 같은 `VERIFY_0753`이다 |
| 비밀번호 추가    | `RequestPasswordSetupCodeUseCase`, `SetPasswordUseCase`  | 소셜 계정에 `PASSWORD_SETUP` 코드로 이메일 로그인 수단을 더한다. 이미 있으면 `USER_0614`                                                                                         |

| 상태          | 행동                              | 다음         | 다시·금지                                      |
| ------------- | --------------------------------- | ------------ | ---------------------------------------------- |
| 수단 n개      | 연결(저장소 `createOAuthAccount`) | n+1          | 같은 공급자 계정이 이미 연결이면 공급자별 오류 |
| 수단 2개 이상 | `unlink(provider)`                | n−1, 뺀 계정 | 없는 공급자 `USER_0603`                        |
| 수단 1개      | `unlink(provider)`                | —            | 없는 공급자 `USER_0603`, 있으면 `USER_0610`    |

## users

| 용어             | 코드                                                | 뜻                                                                                                                                                                                                                                                              |
| ---------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 사용자           | `User`(Aggregate), `UserId`                         | 이메일·Aido ID·역할·상태·이메일 인증 시각·탈퇴 시각을 가진 계정. 프로필(이름·이미지)은 `UserProfile` 행이다                                                                                                                                                     |
| 계정 상태        | `UserStatus`, `USER_STATUS`                         | `PENDING_VERIFY`(메일 인증 전)·`ACTIVE`·`SUSPENDED`(정지, 탈퇴 대기도 이 값)·`LOCKED`(로그인 거절. 이 값으로 바꾸는 행동은 없다)                                                                                                                                |
| 역할             | `UserRole`, `USER_ROLE`, `@Admin()`                 | `USER`·`ADMIN`. 관리자 API는 ADMIN이 아니면 `ADMIN_1401`                                                                                                                                                                                                        |
| 가입             | `RegisterUseCase`, `ProvisionUserUseCase`           | 이메일·소셜 가입이 `ProvisionUserUseCase`로 모여 User·로그인 수단·프로필·약관 동의·설정 기본값·기본 카테고리를 한 트랜잭션에 만든다. 같은 이메일 `EMAIL_0501`                                                                                                   |
| 소셜 가입        | `isNewUser`, `NotifyOAuthSignupUseCase`             | 소셜 첫 로그인은 ACTIVE·이메일 인증 완료로 만들고 관리자 가입 알림을 보낸다. 선택 동의 화면이 없어 광고 동의는 넣지 않는다                                                                                                                                      |
| Aido ID          | `userTag`, `generateUserTag`, `USER_TAG_LENGTH`     | 가입 때 헷갈리는 글자를 뺀 대문자·숫자로 만든다. 겹치면 다시 만들고 끝내 못 만들면 `USER_0611`                                                                                                                                                                  |
| 로그인 상태 검사 | `assertStatusAllowsLogin`                           | LOCKED `USER_0607`, SUSPENDED·탈퇴 대기 `USER_0605`. 로그인·세션 확인·인증 메일이 같은 함수를 쓴다. 비밀번호 로그인의 PENDING_VERIFY는 `EMAIL_0503`                                                                                                             |
| 내 정보          | `GetCurrentUserUseCase`, `UpdateProfileUseCase`     | `/me` 응답. 프로필·구독·설정을 5분(프리미엄 경계 전까지) 캐시한다. 이름·이미지를 바꾸면(이미지 null은 지움) 캐시를 비운다                                                                                                                                       |
| 마지막 활동      | `LastActiveInterceptor`, `UserActivityReaderPort`   | 인증 요청마다 `lastActiveAt`·활동일(`UserActivityDay`)·앱 버전을 사용자당 한 시간에 한 번 남긴다. 앱 버전이 바뀌면 바로 남긴다                                                                                                                                  |
| 마지막 앱 버전   | `UserAppVersionReaderPort`                          | 마지막 인증 요청의 `X-App-Version`. 푸시 권한이 없어도 남는다                                                                                                                                                                                                   |
| 탈퇴             | `DeleteAccountUseCase`, `requestDeletion`           | 이메일 계정은 비밀번호를 확인한다(없으면 `USER_0612`, 틀리면 `USER_0602`). SUSPENDED·탈퇴 시각을 남기고 모든 세션을 폐기한다                                                                                                                                    |
| 탈퇴 유예        | `ACCOUNT_DELETION`, `requiresRestoration`           | 탈퇴 뒤 30일(UTC 24시간 단위). 끝 시각 전에 다시 로그인하면 복구하고, 끝 시각부터는 `USER_0606`이고 영구 삭제 대상이다                                                                                                                                          |
| 복구             | `RestoreAccountUseCase`, `restore`                  | 유예 안의 로그인이 ACTIVE로 되돌리고 응답에 `accountRestored`를 싣는다. 권한·프로필 캐시를 함께 비운다                                                                                                                                                          |
| 영구 삭제        | `PurgeDeletedAccountsUseCase`, `account-purge.v1`   | 매일 03:00 KST. 유예가 지난 계정을 잠근 뒤 다시 판단하고 알림·댓글·사용량을 정리해 지운다. 실패가 있으면 경보 `identity.account-purge.failed`                                                                                                                   |
| 성장 요약        | `GrowthSummaryReadModel`, `GetGrowthSummaryUseCase` | 관리자 화면(`GET /v1/admin/growth/summary`, `IdentityUsersAdminModule`)의 가입·활동(DAU·WAU·MAU·stickiness)·리텐션(d1·d7·d30) 지표. 가입·활동일은 identity 행, 24시간 안 할 일 생성·완료는 planning `TodoActivationReaderPort`가 cohort 전체를 한 문장으로 센다 |
| cohort 집계      | `tallyGrowthCohort`, `activationWindowOf`           | 활성화 대상은 가입 뒤 24시간이 끝난 사람, 리텐션 대상은 측정 시작 뒤 가입했고 그 리텐션 날짜가 기준 현지 날짜보다 앞선 사람이다                                                                                                                                 |
| 가입 정보 조회   | `UserSignupReaderPort`                              | operations 관리자 알림이 사용자 블록(처음 만든 로그인 수단 포함)·일일 가입 수·전체 사용자 수를 읽는 문                                                                                                                                                          |
| 스토어 앱 사용자 | `StoreAppUserReaderPort`                            | billing 웹훅이 RevenueCat appUserId(User.id 또는 별칭)로 사용자 이메일·이름을 한 문장으로 읽는 문. 별칭이 User.id보다 먼저다                                                                                                                                    |
| 대상 사용자 조각 | `userAudience`                                      | 다른 Context가 사람을 id 순서로 한 SQL에 고를 때 쓰는 사용자 테이블·칸·탈퇴·상태·로그인 조건. 부르는 쪽은 자기 조건만 `refine`으로 붙인다                                                                                                                       |
| 지표 정의        | `GROWTH_METRIC_DEFINITIONS`, `GrowthCohortMetric`   | 운영 문서와 같은 문장. 비율은 %(소수 둘째 자리)이고 측정 전이거나 대상 cohort가 없으면 리텐션은 `null`이다                                                                                                                                                      |

| 상태            | 행동                                      | 다음                      | 다시·금지                                       |
| --------------- | ----------------------------------------- | ------------------------- | ----------------------------------------------- |
| 없음            | 이메일 가입(`RegisterUseCase`)            | PENDING_VERIFY, 인증 코드 | 같은 이메일(인증 전 포함) `EMAIL_0501`          |
| 없음            | 소셜 가입(`ProvisionUserUseCase`)         | ACTIVE, 이메일 인증 시각  | 동시에 같은 이메일이 먼저 커밋되면 `EMAIL_0501` |
| PENDING_VERIFY  | 이메일 인증(`markEmailVerified` → `save`) | ACTIVE                    | 이미 인증 `USER_0604`, 다시 부르면 `false`      |
| 탈퇴 전         | `requestDeletion(now)`                    | SUSPENDED, 탈퇴 시각      | 이미 탈퇴면 `USER_0606`. 결과를 돌려주지 않는다 |
| 탈퇴, 유예 안   | `restore(now)`                            | ACTIVE, 탈퇴 시각 지움    | 탈퇴 전이면 `false`                             |
| 탈퇴, 유예 지남 | `restore`·로그인                          | —                         | `USER_0606`                                     |
| 탈퇴, 유예 지남 | `isPurgeEligibleAt` → `hardDelete`        | 없음                      | 잠근 뒤 복구됐으면 건너뛴다                     |

## user-preferences

| 용어                | 코드                                                                                          | 뜻                                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 설정                | `UserPreference`(Aggregate), `UpdatePreferenceUseCase`, `UserPreferenceReaderPort`            | 푸시·야간 푸시·AI 푸시·시간대·언어·시간 표기(`TIME_FORMATS`)·리마인더·날씨 알림 시각과 연속 완료. 바꾸는 요청은 준 값만 바꾼다(PATCH)                           |
| 기본 설정           | `SeedUserSettingsUseCase`, `UserSettingsProvisionerPort`                                      | 가입 트랜잭션 안에서 설정·동의 행을 만든다                                                                                                                      |
| 시간대              | `UpsertPushTimezoneUseCase`, `RefreshPushTimezoneUseCase`, `TimezoneSelfHealInterceptor`      | 사용자 현지 날짜의 기준. 바뀌면 할 일 시간대 재계산 작업을 넣는다. 요청 시간대와 다르면 응답과 따로 고치고 행이 없으면 만들지 않는다. 틀린 IANA 이름 `SYS_0002` |
| 리마인더 시각       | `ReminderTime`(VO), `CUSTOM_REMINDER_TIME`                                                    | 아침 0–11시, 저녁 12–23시. 바꾸려면 프리미엄 권한(`PREFERENCE_1701`), 범위 밖은 `PREFERENCE_1702`. 바꾸면 그날 예약을 바로 다시 넣는다                          |
| 연속 완료           | `Streak`(VO), `currentStreak`·`longestStreak`·`lastCompletedDate`                             | 사용자 시간대로 그날 할 일을 모두 끝낸 날이 이어진 수(스트릭). 현재·최장·마지막 완료 날짜                                                                       |
| 완료 반영           | `OnTodoToggledUseCase`, `UserStreakAccessPort`                                                | planning이 완료를 바꾼 뒤 부른다. 읽은 값이 그대로일 때만 저장하고(`updateStreakIfUnchanged`) 3번까지 다시 읽는다. 실패해도 할 일 변경은 되돌리지 않는다        |
| 3일 달성            | `reachedStreak3`, `StreakMilestoneNotifierPort`                                               | 연속 완료가 정확히 3이 된 반영에만 알림 작업을 넣는다                                                                                                           |
| 저녁 스트릭         | `computeEffectiveStreak`                                                                      | 저녁 리마인더가 아직 반영 전 완료까지 셈한 값. 2일 이상 이어지다 오늘 덜 끝냈으면 위기(`isAtRisk`)                                                              |
| 약관 동의           | `UserConsentRecord`, `TERMS_VERSION`                                                          | 가입 때 이용약관·개인정보 동의 시각과 약관 버전                                                                                                                 |
| 광고성 수신 동의    | `UpdateMarketingConsentUseCase`, `UpdateMarketingPushConsentUseCase`                          | 이메일·앱 푸시를 따로 받는다. 동의 시각이 있으면 동의, null이면 거부                                                                                            |
| 수신 동의 재확인    | `marketingReconfirmCutoff`, `marketingAgreedSince`, `MARKETING_CONSENT_RECONFIRM_YEARS`       | 동의(또는 마지막 재확인)가 2년 지난 활성 사용자에게 동의 사실을 다시 알린다. 두 실행이 같은 사용자를 골라도 한 번만 기록한다                                    |
| AI 데이터 처리 동의 | `AiDataSharingConsent`(Entity), `AI_DATA_SHARING_DECISIONS`, `AiDataSharingConsentReaderPort` | 할 일·메모 글자를 AI 처리 업체로 보내도 되는지. AGREED·DECLINED·UNDECIDED. HTTP guard·예약 작업·음성 계획이 같은 판정을 쓴다                                    |
| 안내 버전           | `AI_DATA_SHARING_CONSENT_VERSIONS`, `allowsAiProcessingAt`                                    | 버전마다 알린 업체가 다르다. 보내려는 업체를 처음 알린 버전 이상에 동의했을 때만 보낸다. 동의 시각이 지금보다 뒤면 아직 동의 전이다                             |
| 발송 설정 조각      | `userDeliveryPreference`, `userMarketingPushConsent`                                          | 다른 Context가 사람 id 칸 옆에 시간대·언어·푸시·야간 설정과 광고성 푸시 동의 시각을 한 SQL로 붙이는 하위 질의. PG가 펼쳐 실행 계획은 테이블 조인과 같다         |
| 리마인더 설정 조각  | `userReminderPreference`                                                                      | 사람 id 칸 옆에 시간대·언어·연속 기록·아침·저녁 리마인더 시각을 붙이는 하위 질의                                                                                |

연속 완료는 Aggregate가 다음 상태 계획을 주고(`planTodoCompletion`·`planTodoUncompletion`) 저장소가 조건부로 쓴다. 바꿀 것이 없으면 `null`이다. 요청 시간대의 오늘이 마지막 완료일과 같거나 앞서면(서쪽 이동) 이미 센 날로 보고 완료일을 뒤로 돌리지 않는다. 설정·동의 값은 Aggregate를 거치지 않고 저장소 upsert로 바꾼다.

| 상태                      | 행동                                 | 다음                              | 다시·금지 |
| ------------------------- | ------------------------------------ | --------------------------------- | --------- |
| 오늘 반영 없음, 어제 완료 | `planTodoCompletion(today)`          | +1, 마지막 = 오늘, 최장 갱신      | —         |
| 오늘 반영 없음, 어제 아님 | `planTodoCompletion(today)`          | 1, 마지막 = 오늘                  | —         |
| 오늘 반영 있음            | `planTodoCompletion`                 | —                                 | `null`    |
| 오늘 반영 있음, 어제 완료 | `planTodoUncompletion(today, true)`  | −1(0 아래로 안 감), 마지막 = 어제 | —         |
| 오늘 반영 있음, 어제 아님 | `planTodoUncompletion(today, false)` | 0, 마지막 없음                    | —         |
| 오늘 반영 없음            | `planTodoUncompletion`               | —                                 | `null`    |

| AI 동의 상태 | 조건                                       | 응답 판정 |
| ------------ | ------------------------------------------ | --------- |
| 답 없음      | 행이 없거나 버전이 없다                    | UNDECIDED |
| 거부·철회    | 버전은 있고 동의 시각이 null               | DECLINED  |
| 동의         | 동의 시각이 있고 버전이 지원 목록에 있다   | AGREED    |
| 옛 동의      | 동의 시각이 있지만 버전이 지원 목록 밖이다 | UNDECIDED |
