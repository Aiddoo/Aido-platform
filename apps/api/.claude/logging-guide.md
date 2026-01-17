# API 로깅 가이드라인

## 개요

이 문서는 Aido API 서버의 로깅 일관성을 유지하기 위한 가이드라인입니다.

## 로깅 레벨 규칙

| 레벨 | 사용 시점 | 예시 |
|------|----------|------|
| `error` | 예외 발생, 시스템 오류 | DB 연결 실패, 외부 API 오류 |
| `warn` | 비정상적이지만 처리 가능한 상황 | 인증 실패, 잘못된 입력 |
| `log` | 중요한 비즈니스 이벤트 | 사용자 생성, 결제 완료 |
| `debug` | 개발 중 디버깅용 | 함수 호출 추적, 변수 값 |
| `verbose` | 상세 추적 정보 | 요청/응답 전체 내용 |

## 레이어별 로깅 패턴

### Service 레이어

Service는 비즈니스 로직의 핵심이므로 **주요 로깅 지점**입니다.

```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async createUser(data: CreateUserDto) {
    this.logger.log(`사용자 생성 시작: ${this.maskEmail(data.email)}`);
    
    try {
      const user = await this.userRepository.create(data);
      this.logger.log(`사용자 생성 완료: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`사용자 생성 실패: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return `${local[0]}***@${domain}`;
  }
}
```

### Repository 레이어

Repository는 데이터 접근 계층이므로 **일반적으로 로깅 불필요**합니다.
- Service에서 이미 비즈니스 이벤트를 로깅
- 복잡한 쿼리나 성능 모니터링 시에만 `debug` 레벨 사용

```typescript
// 필요한 경우에만
async findByEmail(email: string): Promise<User | null> {
  this.logger.debug(`이메일로 사용자 조회: ${email}`);
  return this.prisma.user.findUnique({ where: { email } });
}
```

### Controller 레이어

Controller는 **로깅 불필요**합니다.
- 요청/응답 로깅은 Interceptor에서 처리
- 인증/인가 로깅은 Guard에서 처리

### Guard 레이어

보안 관련 이벤트는 **warn 레벨로 로깅**합니다.

```typescript
this.logger.warn(`인증 실패: 유효하지 않은 토큰 - IP: ${ip}`);
this.logger.warn(`권한 부족: userId=${userId}, resource=${resource}`);
```

## 민감 정보 처리

### 절대 로깅 금지

- 비밀번호 (평문/해시 모두)
- 액세스 토큰, 리프레시 토큰
- API 키, 시크릿 키
- 개인 식별 번호 (주민번호, 전화번호 등)

### 마스킹 필수

| 데이터 | 마스킹 방법 | 예시 |
|--------|------------|------|
| 이메일 | 첫 글자 + *** + 도메인 | `t***@example.com` |
| 전화번호 | 앞 3자리 + **** + 뒤 4자리 | `010-****-1234` |
| IP 주소 | 전체 출력 가능 | `192.168.1.100` |

### 마스킹 유틸리티

```typescript
// common/utils/mask.util.ts
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local[0]}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return '***';
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}
```

## 로깅 포맷

### 표준 메시지 형식

```
[동작] [대상]: [상세 정보]
```

### 예시

```typescript
// 좋은 예
this.logger.log(`사용자 생성 완료: userId=${user.id}`);
this.logger.warn(`인증 실패: 잘못된 비밀번호 - email=${maskEmail(email)}`);
this.logger.error(`외부 API 호출 실패: provider=kakao, status=${status}`);

// 나쁜 예
this.logger.log(`user created`);  // 한국어 사용, 상세 정보 부족
this.logger.log(`사용자가 생성되었습니다.`);  // ID 정보 누락
this.logger.error(error);  // 메시지 없이 에러 객체만
```

## 에러 로깅 패턴

### 예외 처리 시

```typescript
try {
  await this.externalApi.call(params);
} catch (error) {
  // 컨텍스트 포함하여 로깅
  this.logger.error(
    `외부 API 호출 실패: provider=${provider}, params=${JSON.stringify(safeParams)}`,
    error.stack,
  );
  throw new BusinessException(ERROR_CODE.EXTERNAL_API_ERROR);
}
```

### BusinessException 발생 시

BusinessException은 이미 예상된 비즈니스 오류이므로 **warn 레벨** 사용:

```typescript
if (!user) {
  this.logger.warn(`사용자 조회 실패: userId=${userId} 존재하지 않음`);
  throw new BusinessException(ERROR_CODE.USER_NOT_FOUND);
}
```

## 환경별 로깅 설정

### 개발 환경 (development)

- 모든 레벨 출력 (debug, verbose 포함)
- 콘솔 출력

### 스테이징 환경 (staging)

- log, warn, error 출력
- 파일 또는 로그 수집 서비스로 전송

### 운영 환경 (production)

- log, warn, error 출력
- 구조화된 JSON 포맷
- 로그 수집 서비스 (CloudWatch, DataDog 등) 연동

## 성능 고려사항

### 비용이 높은 로깅 피하기

```typescript
// 나쁜 예: 매번 JSON.stringify 실행
this.logger.debug(`요청 데이터: ${JSON.stringify(largeObject)}`);

// 좋은 예: debug 레벨인 경우만 실행
if (this.logger.isLevelEnabled('debug')) {
  this.logger.debug(`요청 데이터: ${JSON.stringify(largeObject)}`);
}
```

### 반복문 내 로깅 주의

```typescript
// 나쁜 예: 1000번 로깅
for (const item of items) {
  this.logger.log(`처리 중: ${item.id}`);
  await this.process(item);
}

// 좋은 예: 시작/종료만 로깅
this.logger.log(`일괄 처리 시작: count=${items.length}`);
for (const item of items) {
  await this.process(item);
}
this.logger.log(`일괄 처리 완료: count=${items.length}`);
```

## 체크리스트

- [ ] Service에서 주요 비즈니스 이벤트 로깅
- [ ] 에러 발생 시 컨텍스트 포함하여 로깅
- [ ] 민감 정보 마스킹 적용
- [ ] 한국어 메시지 사용
- [ ] 적절한 로깅 레벨 선택
- [ ] Repository/Controller에서 불필요한 로깅 제거
