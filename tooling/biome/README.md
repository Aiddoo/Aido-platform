# @aido/biome-config

Aido 모노레포 공유 Biome 설정

## 설정 파일

### biome.json

모든 패키지의 기본 Biome (린터/포매터) 설정

## 주요 설정

### Linter 규칙

| 규칙 | 수준 | 설명 |
|-----|-----|------|
| noUnusedImports | error | 사용하지 않는 import 금지 |
| noUnusedVariables | error | 사용하지 않는 변수 금지 |
| useConst | error | 재할당 없는 변수는 const 사용 |
| noNonNullAssertion | warn | ! 연산자 경고 |
| noExplicitAny | warn | any 타입 경고 |

### Formatter 설정

| 옵션 | 값 | 설명 |
|-----|---|------|
| indentStyle | space | 스페이스 들여쓰기 |
| indentWidth | 2 | 2칸 들여쓰기 |
| lineWidth | 100 | 최대 줄 길이 |
| quoteStyle | single | 작은따옴표 사용 |
| trailingCommas | all | 후행 쉼표 항상 사용 |
| semicolons | always | 세미콜론 항상 사용 |

## 사용 방법

루트 `biome.json`에서 확장:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.2.4/schema.json",
  "extends": ["./tooling/biome/biome.json"],
  "files": {
    "ignore": ["node_modules", "dist", "build"]
  }
}
```

## 명령어

```bash
# 포맷팅
pnpm format

# 린트 + 포맷 체크
pnpm check

# 린트만
pnpm lint

# 자동 수정
pnpm lint:fix
```

## 라이선스

MIT
