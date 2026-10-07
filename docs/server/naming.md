# 서버 이름과 역할

이름·경로를 바꿀 때 쓰는 기준이다. 작성 패턴은 [api-conventions.md](../../apps/api/.claude/api-conventions.md), 경계의 이유는 [architecture.md](../../apps/api/.claude/architecture.md)에 있다. [migration.md](migration.md)는 전환 이력을, [ci.md](ci.md)는 현재 검사 연결을 소유한다.

## 경로와 실제 사례

| 역할                     | 경로/접미사                                       | 현재 사례                                                                    |
| ------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| Slice 조립               | `<context>-<slice>.module.ts`                     | `PlanningTodosModule`, `WeatherForecastModule`, `NotificationDeliveryModule` |
| 순수 Application factory | `<context>-<slice>-application.providers.ts`      | `getMemoProvider`                                                            |
| 최소 공개 capability     | `<context>-<slice>.public.ts`                     | `weather-forecast.public.ts`                                                 |
| 상태 일관성 경계         | `domain/aggregates/<slice>/*.aggregate.ts`        | `Todo`, `Notification`                                                       |
| 식별되는 모델            | `domain/entities/<slice>/*.entity.ts`             | `TodoItem`, `AiReport`                                                       |
| 검증·불변 값             | `domain/value-objects/<slice>/*.vo.ts`            | `TodoSchedule`, `Coordinate`                                                 |
| 흐름/조회                | `application/use-cases/<slice>/*.use-case.ts`     | `CreateTodo`, `GetMemo`                                                      |
| Port                     | `application/ports/<slice>/*.<role>.port.ts`      | `WeatherGridResolverPort`, `WeatherForecastReaderPort`                       |
| 외부 경계 구현           | `infrastructure/adapters/<slice>/*.<role>.ts`     | `KmaWeatherGridResolver`                                                     |
| 저장 구현                | `infrastructure/persistence/<slice>/*.<role>.ts`  | `PrismaWeatherLocationRepository`                                            |
| 조회/응답 projection     | `application/read-models`, `presentation/mappers` | `NotificationRecord`, `toAiReportView`                                       |
| key/TTL                  | `infrastructure/cache/<slice>/*.keyspace.ts`      | `weather-cache.keyspace.ts`                                                  |

역할을 이름으로 설명한다. Repository는 영속 상태, Reader는 조회, Sender는 발송, Recorder는 기록, Publisher는 발행, Resolver는 해석, Adapter는 경계 변환, Policy는 순수 판단이다. Registry는 실제 여러 구현의 선택 정책이 있을 때 사용한다. 기존 Processor/JobHandler는 queue 소비 역할을 따른다. 새 `Impl`·`Manager`·전달 전용 Facade로 실제 역할을 감추지 않는다.

파일·폴더는 kebab-case, 클래스·타입은 PascalCase, 변수·필드는 camelCase다. `nudgeId`/`friendIds`, `repliedAt`/`replyUpdatedAt`, `timeoutMs`/`ttlSeconds`처럼 값의 의미·복수·단위를 드러낸다. boolean은 is/has/can/should를 기본으로 하되 공개된 enabled 등 DTO·DB·payload 필드를 내부 명명 때문에 바꾸지 않는다.

private 상태·의존성은 `#` field로, 불변 참조는 readonly로 표현한다. 객체 입력·출력의 불변성과 PATCH null/undefined 의미는 [코드 기준](../../apps/api/.claude/api-conventions.md)에서 확인한다.

## 폴더·별칭·주석

필요한 역할 폴더만 만든다. 필드마다 VO·상태 없는 query마다 Aggregate·단일 구현마다 Registry를 만들지 않는다. library/SDK 기본 API와 기존 공유 기능을 사용할 수 있으면 같은 기능의 자체 wrapper를 추가하지 않는다.

없는 소비를 위해 legacy forwarding 파일·alias·unused export를 유지하지 않는다. 실제 소비를 검색해 제거하되 배포된 HTTP·구 앱·DB/queue/cache 계약은 내부 이름과 구분한다. 문서의 새 명명 기준이 기존 전체 파일의 전환 완료를 뜻하지 않는다. Operations/Support/AppConfig 후속 정리 등 현재 상태는 전환 이력과 해당 소스로 확인한다.

주석은 코드의 동작을 다시 말하지 않고 잠금·재시도·멱등성·호환성 같은 이유를 남긴다. SOLID나 Clean Architecture는 형식적인 레이어/인터페이스 수를 늘리는 근거가 아니다.

포맷은 root Oxfmt 설정이 소유한다. 서버/공유 계약은 2칸·큰따옴표·세미콜론·기준 폭 100이며 생성물·고정 released fixture는 기존 제외 설정을 따른다. 관련 없는 Mobile 포맷 변경을 섞지 않는다. Oxlint의 파일명·import/cycle 검사는 일부 형식을 확인하며 이름만으로 업무 책임의 적절성을 증명하지 않는다.
