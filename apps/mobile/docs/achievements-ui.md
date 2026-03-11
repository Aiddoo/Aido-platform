# 달성 배지 화면 UI 가이드

## 목적
- 화면 위치: `app/(app)/achievements`
- 목표: 사용자가 매주 어떤 수준으로 목표를 달성했는지 `배지 + 상장형 카드`로 빠르게 이해하게 한다.
- 디자인 톤: `AI 리포트` 화면처럼 종이 카드 느낌, 점선 구분선, 통계 블록 중심
- 현재 API 기준으로는 `수집형 업적 카탈로그`보다 `주간 성과 배지 히스토리` 화면이 맞다.

## 사용 API

### 1. 목록 조회
- `GET /api/v1/weekly-achievements?year=2026`
- 용도: 배지 목록 화면의 메인 데이터

### 2. 상세 조회
- `GET /api/v1/weekly-achievements/:year/:week`
- 용도: 특정 주차 배지 상세 바텀시트 또는 상세 페이지

## 목록 API 응답 기준

실제 앱에서는 공통 응답 래퍼를 포함해 아래 형태로 받는다고 보면 된다.

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 42,
        "year": 2026,
        "week": 10,
        "weekLabel": "3월 2주차",
        "dateRange": {
          "startDate": "2026-03-02",
          "endDate": "2026-03-08"
        },
        "totalTodos": 15,
        "completedTodos": 14,
        "completionRate": 93,
        "achievedAt": "2026-03-08T11:00:00.000Z"
      }
    ],
    "pagination": {
      "nextCursor": 9,
      "hasNext": true,
      "size": 20
    },
    "summary": {
      "totalWeeks": 8,
      "perfectWeeks": 3,
      "currentStreak": 4,
      "bestStreak": 6,
      "averageRate": 87
    }
  },
  "timestamp": "2026-03-11T10:00:00.000Z"
}
```

## 뱃지 등급 기준

현재 서버 로직과 가장 일관된 기준은 완료율 3단계 분기다.

| 조건 | 배지 타입 | 의미 |
| --- | --- | --- |
| `completionRate === 100` | `Perfect` | 이번 주 할 일을 모두 완료 |
| `completionRate >= 90 && completionRate < 100` | `Almost` | 거의 다 완료 |
| `completionRate > 0 && completionRate < 90` | `Completed` | 일부라도 완료 |
| 기록 없음 또는 `completionRate === 0` | `Locked` 또는 미노출 | 달성 배지 없음 |

### 추천 표현
- `Perfect`: 금색, 강조된 메달/별 아이콘
- `Almost`: 오렌지 또는 실버, 거의 찬 배지
- `Completed`: 블루 또는 그린, 기본 배지
- `Locked`: 회색 아웃라인 또는 숨김

## 디자인 방향

AI 리포트 화면 톤을 그대로 가져오되, 내용만 `배지 상장`으로 바꾼다.

핵심 포인트:
- 화면 전체를 피드 리스트처럼 만들기보다 `상장 카드 한 장`이 중심이 되게 한다.
- 카드 내부는 `헤더`, `배지 존`, `수치 요약`, `주간 기록 리스트` 순서로 쪼갠다.
- 섹션 사이에는 리포트처럼 `점선 구분선`을 둔다.
- 배지 이미지는 실제 리소스가 들어오기 전까지 `정사각형/원형 플레이스홀더`로 자리만 잡는다.

추천 무드:
- 배경: `bg-gray-1` 계열의 아주 옅은 톤
- 카드: 아이보리/화이트 계열 큰 종이 카드
- 카드 테두리: 옅은 라인 + 둥근 모서리
- 포인트: 금색/오렌지/블루를 배지 등급에 따라 사용

## 화면 구조

### 전체 레이아웃
- 상단: 연도 선택
- 본문: `상장형 대표 카드`
- 하단: `이번 해 받은 배지 기록 리스트`
- 상세는 별도 페이지보다 `바텀시트` 또는 `카드 확장`이 자연스럽다.

### 1. 상단 요약 영역
- 목적: 올해 달성 흐름을 한 번에 보여준다.
- 데이터 출처: `data.summary`

표시 항목:
- `perfectWeeks`: 완벽 달성 주 수
- `currentStreak`: 현재 연속 달성 주
- `bestStreak`: 최고 연속 달성 주
- `averageRate`: 평균 완료율

추천 UI:
- `상장 카드` 상단 헤더 영역으로 배치
- 작은 칩: `2026 주간 달성 배지`
- 큰 타이틀: `이번 해의 달성 기록`
- 서브카피: `매주 쌓인 성과를 한 장의 상장처럼 보여준다`

예시 카피:
- `올해 가장 빛난 주간 기록`
- `완벽 달성 3회`
- `현재 4주 연속 달성 중`

### 2. 연도 필터
- 목적: `2026`, `2025` 같은 연도별 기록 이동
- 데이터 출처: 화면 상태
- 요청 파라미터: `year`

추천 UI:
- 상단 세그먼트 또는 드롭다운
- 연도 변경 시 목록 API 재조회

### 3. 대표 상장 카드
- 목적: 가장 최근 주차 또는 가장 좋은 기록을 상장처럼 강조한다.
- 데이터 출처:
  - 대표 배지: 기본은 `items[0]`
  - 보조 수치: `summary`

상장 카드 내부 구성:
- 헤더 줄
  - 좌측 칩: `주간 배지`
  - 우측 텍스트: `2026년`
- 중앙 배지 존
  - 큰 배지 이미지 위치
  - 배지명 텍스트
  - 짧은 카피
- 통계 요약 줄
  - `평균 완료율`
  - `완벽 달성`
  - `연속 달성`
- 하단 인증 줄
  - `3월 2주차`
  - `2026-03-02 ~ 2026-03-08`
  - `14 / 15 완료`

상장 카드 예시 구조:

```text
┌──────────────────────────────┐
│ [주간 배지]             2026 │
│                              │
│         [ 배지 이미지 ]       │
│                              │
│         거의 다 해냈어        │
│       이번 주 완료율 93%      │
│                              │
│  평균 완료율   완벽 달성  연속 │
│     87%         3회      4주  │
│                              │
│ ---------------------------- │
│  3월 2주차                   │
│  2026.03.02 - 2026.03.08     │
│  14개 중 15개 완료           │
└──────────────────────────────┘
```

배지 이미지 자리:
- 중앙 상단에 크게 배치
- 비율은 `1:1`
- 실제 이미지는 나중에 교체
- 현재는 원형 또는 정사각형 플레이스홀더로 처리

대표 배지 선택 기준:
- 기본: `items[0]` 사용
- 이유: API가 최신 주차 순으로 내려옴
- 대안: `completionRate`가 가장 높은 항목을 따로 선택할 수도 있지만 1차 구현은 최신 주차 기준이 안전함

대표 배지 문구 예시:
- `Perfect`: `이번 주 전부 다 해냈어`
- `Almost`: `거의 다 해냈어`
- `Completed`: `이번 주도 한 걸음 전진했어`

### 4. 주간 배지 기록 리스트
- 목적: 주차별 달성 기록을 시간순으로 보여준다.
- 데이터 출처: `data.items`

카드에 들어갈 값:
- `weekLabel`: 카드 제목
- `dateRange.startDate ~ dateRange.endDate`: 주간 기간
- `completionRate`: 배지 등급 판정 + 진행률 텍스트
- `completedTodos / totalTodos`: 서브 텍스트
- `achievedAt`: 필요하면 "배지 획득일"로 표기

추천 UI:
- 상장 카드 아래에 리포트 리스트처럼 세로로 배치
- 각 행 왼쪽에 작은 배지 자리
- 오른쪽에 주차 정보와 완료율
- 각 행 사이에 `점선 divider`

카드 예시:

```text
[배지]  3월 2주차
       2026.03.02 - 2026.03.08
       15개 중 15개 완료
       완료율 100%
```

```text
[배지]  3월 1주차
       2026.02.23 - 2026.03.01
       14개 중 15개 완료
       완료율 93%
```

리스트 한 줄 구성 추천:
- 왼쪽: 배지 썸네일 자리
- 가운데: `weekLabel`, 기간
- 오른쪽: `completionRate`

### 5. 빈 상태
- 조건: `data.items.length === 0`
- 추천 카피:
  - `아직 받은 달성 배지가 없어요`
  - `이번 주 할 일을 완료하고 첫 배지를 받아보세요`

추천 UI:
- 작은 상장/배지 플레이스홀더
- 짧은 설명
- 필요하면 `할 일 보러 가기` CTA

## 상세 화면 또는 바텀시트

상세 API 응답도 목록 아이템 한 개와 거의 동일하다.

```json
{
  "success": true,
  "data": {
    "id": 42,
    "year": 2026,
    "week": 10,
    "weekLabel": "3월 2주차",
    "dateRange": {
      "startDate": "2026-03-02",
      "endDate": "2026-03-08"
    },
    "totalTodos": 15,
    "completedTodos": 14,
    "completionRate": 93,
    "achievedAt": "2026-03-08T11:00:00.000Z"
  }
}
```

상세에서 보여줄 것:
- 배지 타입
- `weekLabel`
- 기간
- 완료율
- 완료한 할 일 수
- 달성 시점

주의:
- 현재 API에는 해당 주의 개별 Todo 목록은 없다.
- 따라서 상세 화면은 `요약 정보 중심`으로 작게 가는 편이 맞다.

상세 표현 추천:
- 상장 카드의 축소판이 아니라 `카드 확장판`
- 상단 큰 배지 이미지
- 가운데 큰 `completionRate`
- 하단에 `completedTodos / totalTodos`, `achievedAt`

## UI 데이터 매핑 표

| UI 요소 | API 필드 |
| --- | --- |
| 대표 배지 상태 | 최신 `items[0].completionRate` |
| 대표 배지 제목 | 최신 `items[0].weekLabel` 또는 배지 타입별 고정 문구 |
| 대표 배지 기간 | `items[0].dateRange.startDate`, `items[0].dateRange.endDate` |
| 대표 배지 완료 수 | `items[0].completedTodos`, `items[0].totalTodos` |
| 완벽 달성 수 | `summary.perfectWeeks` |
| 현재 연속 달성 | `summary.currentStreak` |
| 최고 연속 달성 | `summary.bestStreak` |
| 평균 완료율 | `summary.averageRate` |
| 주차 제목 | `items[].weekLabel` |
| 주차 기간 | `items[].dateRange.startDate`, `items[].dateRange.endDate` |
| 완료 개수 | `items[].completedTodos` |
| 전체 개수 | `items[].totalTodos` |
| 완료율 | `items[].completionRate` |
| 배지 획득 시점 | `items[].achievedAt` |

## 뱃지 타입 계산 예시

```ts
type BadgeType = 'perfect' | 'almost' | 'completed' | 'locked';

export function getWeeklyBadgeType(completionRate: number): BadgeType {
  if (completionRate === 100) return 'perfect';
  if (completionRate >= 90) return 'almost';
  if (completionRate > 0) return 'completed';
  return 'locked';
}
```

## 1차 구현 범위
- 연도 선택
- 상장형 대표 카드
- 주간 배지 리스트
- 무한 스크롤 또는 더보기
- 카드 탭 시 간단한 상세 바텀시트

## 2차 확장 아이디어
- 배지 이미지 실제 리소스 연결
- `Perfect` 배지 연속 획득 강조
- 월별 섹션 그룹핑
- 대표 배지 애니메이션
- 배지 공유하기

## 구현 메모
- API는 주차 최신순으로 내려온다.
- 페이지네이션은 `pagination.nextCursor`를 다음 요청 `cursor`에 넣어 이어받는다.
- 현재 데이터 모델은 `업적 컬렉션`이 아니라 `주간 달성 기록`이다.
- 따라서 화면 제목이 `달성 배지`여도 실제 UX는 `주간 배지 기록`에 가깝게 설계하는 것이 자연스럽다.
- 디자인은 AI 리포트처럼 `카드 한 장이 중심`인 구조가 맞다.
- 실제 배지 이미지는 추후 교체되므로, 우선은 `배지 슬롯`과 `문구/수치 배치`를 먼저 고정한다.
