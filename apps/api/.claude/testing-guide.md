# Aido API 종합 테스팅 가이드

> Unit → Integration → E2E 순서로 테스트 작성 및 실행 가이드

---

## 목차

1. [테스트 개요](#1-테스트-개요)
2. [Unit 테스트](#2-unit-테스트)
3. [Integration 테스트](#3-integration-테스트)
4. [E2E 테스트](#4-e2e-테스트)
5. [공통 규칙](#5-공통-규칙)
6. [참고 자료](#6-참고-자료)

---

## 1. 테스트 개요

### 1.1 테스트 피라미드

```
        /\
       /E2E\        적은 수, 느림, 실제 환경
      /------\
     /Integ- \      중간, NestJS DI 검증
    / ration  \
   /------------\
  /    Unit      \  많은 수, 빠름, 격리됨
 /----------------\
```

| 유형 | 파일 패턴 | 목적 | 도구 |
|------|----------|------|------|
| Unit | `*.spec.ts` | 개별 클래스/메서드 동작 검증 | Suites + Builder |
| Integration | `*.integration-spec.ts` | 서비스 계층 통합 검증 | NestJS TestingModule |
| E2E | `*.e2e-spec.ts` | 전체 API 흐름 검증 | supertest + Testcontainers |

### 1.2 파일 구조

```
apps/api/
├── src/
│   └── modules/
│       └── {name}/
│           ├── {name}.service.ts
│           └── {name}.service.spec.ts    # Unit 테스트
│
└── test/
    ├── e2e/
    │   └── {name}.e2e-spec.ts            # E2E 테스트
    ├── integration/
    │   └── {name}.integration-spec.ts    # Integration 테스트
    ├── builders/                          # 테스트 데이터 빌더
    │   ├── index.ts
    │   ├── user.builder.ts
    │   ├── notification.builder.ts
    │   └── ...
    ├── mocks/                             # FakeService들
    │   ├── fake-email.service.ts
    │   └── fake-oauth-token-verifier.service.ts
    └── setup/
        ├── suites.setup.ts                # Suites 유틸리티
        ├── test-database.ts               # TestDatabase 헬퍼
        ├── test-database.service.ts       # TestDatabaseService
        ├── global-setup.ts                # Jest global setup
        └── global-teardown.ts             # Jest global teardown
```

---

## 2. Unit 테스트

### 2.1 개요

| 항목 | 설명 |
|------|------|
| **파일 위치** | 테스트 대상과 같은 폴더 (`src/modules/{name}/`) |
| **명명 규칙** | `{파일명}.spec.ts` |
| **도구** | Suites (자동 Mock) + Builder (테스트 데이터) |
| **목적** | 개별 클래스/메서드의 독립적인 동작 검증 |

### 2.2 Suites 패턴

```typescript
// Suites 라이브러리 (자동 mock 생성)
import { TestBed } from "@suites/unit";
import type { Mocked } from "@suites/doubles.jest";

// 테스트 대상 서비스 (프로젝트 내부)
import { AuthService } from "@/modules/auth/services/auth.service";
import { UserRepository } from "@/modules/auth/repositories/user.repository";

describe("AuthService", () => {
  let service: AuthService;
  let userRepo: Mocked<UserRepository>;

  beforeEach(async () => {
    // Suites가 모든 의존성을 자동으로 mock
    const { unit, unitRef } = await TestBed.solitary(AuthService).compile();

    service = unit;
    userRepo = unitRef.get(UserRepository);
  });

  // 테스트 케이스들...
});
```

### 2.3 Builder 패턴

```typescript
import { UserBuilder, NotificationBuilder } from "@test/builders";

// 기본 사용자
const user = UserBuilder.create().build();

// 커스텀 사용자
const admin = UserBuilder.create()
  .withEmail("admin@example.com")
  .asAdmin()
  .verified()
  .build();

// ID 카운터 리셋 (beforeEach에서)
beforeEach(() => {
  NotificationBuilder.resetIdCounter();
  UserBuilder.resetIdCounter();
});
```

### 2.4 GWT 형식

```typescript
it("유효한 토큰을 등록해야 한다", async () => {
  // Given - 유효한 Expo 푸시 토큰 데이터 준비
  const data = { userId: mockUserId, token: "ExponentPushToken[xxx]" };
  const expectedToken = PushTokenBuilder.create(mockUserId).build();
  notificationRepo.registerPushToken.mockResolvedValue(expectedToken);

  // When - 푸시 토큰 등록 요청
  const result = await service.registerPushToken(data);

  // Then - 토큰 검증 및 저장 확인
  expect(pushProvider.validateToken).toHaveBeenCalledWith(data.token);
  expect(result).toEqual(expectedToken);
});
```

### 2.5 실행 명령어

```bash
# 전체 단위 테스트
pnpm --filter @aido/api test

# 특정 파일
pnpm --filter @aido/api test notification.service.spec

# Watch 모드
pnpm --filter @aido/api test:watch
```

**상세 가이드**: [unit-test.md](./unit-test.md)

---

## 3. Integration 테스트

### 3.1 개요

| 항목 | 설명 |
|------|------|
| **파일 위치** | `test/integration/` |
| **명명 규칙** | `{도메인}.integration-spec.ts` |
| **도구** | NestJS TestingModule + Mock DatabaseService |
| **목적** | NestJS DI와 서비스 계층 통합 검증 |

### 3.2 기본 구조

```typescript
import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";
import { CheerRepository } from "@/modules/cheer/cheer.repository";
import { CheerService } from "@/modules/cheer/cheer.service";
import { CheerBuilder, UserBuilder } from "@test/builders";

describe("CheerService Integration Tests", () => {
  let module: TestingModule;
  let service: CheerService;

  // Mock 데이터베이스 서비스
  const mockCheerDb = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };

  const mockDatabaseService = {
    cheer: mockCheerDb,
    $transaction: jest.fn(),
  };

  beforeAll(async () => {
    // Logger 출력 비활성화
    jest.spyOn(Logger.prototype, "log").mockImplementation();

    module = await Test.createTestingModule({
      providers: [
        CheerService,
        CheerRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<CheerService>(CheerService);
  });

  afterAll(async () => {
    await module.close();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    CheerBuilder.resetIdCounter();
  });

  // 테스트 케이스들...
});
```

### 3.3 실행 명령어

```bash
# 전체 통합 테스트
pnpm --filter @aido/api test:integration

# 특정 파일
pnpm --filter @aido/api test cheer.integration-spec
```

**상세 가이드**: [integration-test.md](./integration-test.md)

---

## 4. E2E 테스트

### 4.1 개요

| 항목 | 설명 |
|------|------|
| **파일 위치** | `test/e2e/` |
| **명명 규칙** | `{도메인}.e2e-spec.ts` |
| **도구** | supertest + Testcontainers (PostgreSQL) |
| **목적** | 사용자 관점에서 전체 API 흐름 검증 |

### 4.2 기본 구조

```typescript
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import { AppModule } from "@/app.module";
import { DatabaseService } from "@/database";
import { EmailService } from "@/modules/email/email.service";
import { FakeEmailService } from "../mocks/fake-email.service";
import { TestDatabase } from "../setup/test-database";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let testDatabase: TestDatabase;
  let fakeEmailService: FakeEmailService;

  beforeAll(async () => {
    testDatabase = new TestDatabase();
    await testDatabase.start();

    fakeEmailService = new FakeEmailService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(testDatabase.getPrisma())
      .overrideProvider(EmailService)
      .useValue(fakeEmailService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
    await testDatabase.stop();
  });

  // 테스트 케이스들...
});
```

### 4.3 헬퍼 함수 패턴

```typescript
// 사용자 등록 및 인증 헬퍼
async function createVerifiedUser(
  email: string,
  password: string,
): Promise<string> {
  await request(app.getHttpServer())
    .post("/auth/register")
    .send({
      email,
      password,
      passwordConfirm: password,
      termsAgreed: true,
      privacyAgreed: true,
    })
    .expect(201);

  const code = fakeEmailService.getLastCode(email);
  const response = await request(app.getHttpServer())
    .post("/auth/verify-email")
    .send({ email, code })
    .expect(200);

  return response.body.data.accessToken;
}

// 사용
it("Todo를 생성해야 한다", async () => {
  const accessToken = await createVerifiedUser("test@example.com", "Test1234!");

  const response = await request(app.getHttpServer())
    .post("/todos")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ title: "Test Todo" })
    .expect(201);

  expect(response.body.data.title).toBe("Test Todo");
});
```

### 4.4 FakeService 패턴

```typescript
// test/mocks/fake-email.service.ts
export class FakeEmailService {
  private sentEmails: Map<string, { code: string }> = new Map();

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    this.sentEmails.set(email, { code });
  }

  getLastCode(email: string): string | undefined {
    return this.sentEmails.get(email)?.code;
  }

  hasSentTo(email: string): boolean {
    return this.sentEmails.has(email);
  }
}
```

### 4.5 실행 명령어

```bash
# 전체 E2E 테스트
pnpm --filter @aido/api test:e2e

# 특정 파일
pnpm --filter @aido/api test:e2e -- auth.e2e-spec
```

**상세 가이드**: [e2e-test.md](./e2e-test.md)

---

## 5. 공통 규칙

### 5.1 DO 체크리스트

- ✅ Suites `TestBed.solitary()` 패턴 사용 (Unit)
- ✅ Builder 패턴으로 테스트 데이터 생성
- ✅ Given/When/Then 주석으로 의도 표현
- ✅ 각 테스트 케이스는 독립적으로 실행 가능
- ✅ Edge case와 에러 케이스 테스트 포함
- ✅ `beforeEach`에서 Builder ID 카운터 리셋
- ✅ FakeService로 외부 서비스 대체 (E2E)
- ✅ 헬퍼 함수로 반복 작업 추출 (E2E)

### 5.2 DON'T 체크리스트

- ❌ Unit 테스트에서 실제 DB 연결
- ❌ Integration 테스트에서 HTTP 요청
- ❌ 테스트 간 상태 공유
- ❌ 하드코딩된 ID 사용 (Builder 사용)
- ❌ 구현 세부사항 테스트 (공개 인터페이스만)
- ❌ 테스트에서 비즈니스 로직 재구현

### 5.3 테스트 실행 명령어 요약

```bash
# Unit 테스트
pnpm --filter @aido/api test                    # 전체
pnpm --filter @aido/api test {파일명}            # 특정 파일
pnpm --filter @aido/api test:watch              # Watch 모드
pnpm --filter @aido/api test:cov                # 커버리지

# Integration 테스트
pnpm --filter @aido/api test:integration        # 전체
pnpm --filter @aido/api test {파일명}            # 특정 파일

# E2E 테스트
pnpm --filter @aido/api test:e2e                # 전체
pnpm --filter @aido/api test:e2e -- {파일명}     # 특정 파일
pnpm --filter @aido/api test:e2e -- -t "패턴"   # 특정 테스트
```

---

## 6. 참고 자료

### 6.1 예제 파일 경로

| 유형 | 예제 파일 |
|------|----------|
| Unit | `src/modules/notification/notification.service.spec.ts` |
| Integration | `test/integration/cheer.integration-spec.ts` |
| E2E | `test/e2e/auth.e2e-spec.ts` |
| Builder | `test/builders/user.builder.ts` |
| FakeService | `test/mocks/fake-email.service.ts` |

### 6.2 관련 문서

| 문서 | 내용 |
|------|------|
| [unit-test.md](./unit-test.md) | 단위 테스트 상세 가이드 |
| [integration-test.md](./integration-test.md) | 통합 테스트 상세 가이드 |
| [e2e-test.md](./e2e-test.md) | E2E 테스트 상세 가이드 |
| [prisma.md](./prisma.md) | Prisma 7 가이드 |
| [api-conventions.md](./api-conventions.md) | API 코드 규칙 |

### 6.3 외부 참조

- [NestJS Suites 공식 문서](https://docs.nestjs.com/recipes/suites)
- [Prisma Testing 가이드](https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing)
- [Testcontainers Node.js](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/)

---

**문서 버전**: 1.0.1
**최종 수정일**: 2026-02-06
