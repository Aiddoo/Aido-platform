// 모바일 층·경계 규칙. 근거는 .claude/architecture.md#층과-의존, #portadapterdi, #모델과-policy.
// 규칙으로 쓸 수 없는 feature 그래프(di-context 훅의 주인, 양방향 쌍)는 scripts/feature-graph.cjs 리포터가 본다.
const { FEATURE_LAYERS, FEATURE_PATTERN } = require('./scripts/feature-graph.cjs');

// src/testing은 테스트 전용이라 앱 층 규칙을 받지 않는다. 대신 아래 testing-from-production이 운영 코드의 import를 막는다
const TEST = '\\.(?:spec|test)\\.[cm]?[jt]sx?$|/__tests__/|^src/testing/';
const FEATURE = `^src/features/(${FEATURE_PATTERN})/`;
const KNOWN_FEATURE = `^src/features/(?:${Object.keys(FEATURE_LAYERS).join('|')})/`;
// 다른 층 어디서든 가져와도 되는 것: 타입(규칙에서 type-only로 뺀다), Policy가 있는 모델, 캐시 무효화 함수
const ANY_LAYER = '/domains/[^/]+\\.model\\.tsx?$|/queries/[^/]+-cache\\.tsx?$';
const DOMAIN_MODEL = '^src/.*/domains/[^/]+\\.model\\.ts$';
const WIRE_CONTRACT =
  '^\\.\\./\\.\\./packages/api/(?:dist|src)/(?:index\\.|contracts/)|^@aido/api(?:$|/contracts/)';

function npm(names) {
  return `(?:^|/node_modules/)(?:${names.join('|')})(?:/|$)`;
}

function paths(prefixes) {
  return `^(?:${prefixes.join('|')})`;
}

// 네이티브·외부 SDK는 shared/infra에서만 import한다(.claude/architecture.md#portadapterdi). 예외 목록은 두지 않는다.
// 이 목록에 넣지 않은 라이브러리와 이유:
// - expo-router: 라우트 파일과 화면의 앱 뼈대다. 라우터 교체는 route 전체를 바꾸는 일이라 포트로 숨기지 않는다.
// - UI 라이브러리(heroui-native, reanimated, gesture-handler, gorhom, expo-image, datetimepicker 등): 화면 그 자체다.
// - expo-widgets, @expo/ui, react-native-android-widget: 위젯은 네이티브가 직접 부르는 자기 조립 진입점이다.
// - expo-constants: 위젯 headless 진입이 scheme을 읽고 env.ts가 빌드 값을 읽는다. Provider 밖 시작 값이다.
// - expo-splash-screen: Provider가 뜨기 전부터 쓰는 부트스트랩 전용이다.
const SDK_MODULES = [
  'ky',
  'expo-auth-session',
  'expo-quick-actions',
  'expo-store-review',
  '@react-native-kakao/core',
  '@react-native-kakao/share',
  'expo-linking',
  'expo-application',
  'expo-device',
  'expo-secure-store',
  'expo-sharing',
  'expo-clipboard',
  'expo-haptics',
  'expo-notifications',
  'expo-speech-recognition',
  'react-native-purchases',
  'expo-audio',
  'expo-keep-awake',
  'expo-file-system',
  'expo-location',
  'react-native-mmkv',
  'expo-network',
  'expo-web-browser',
  'expo-apple-authentication',
  'expo-updates',
  'expo-localization',
  'expo-crypto',
  'react-native-view-shot',
  '@sentry/react-native',
  '@react-native-firebase/app',
  '@react-native-firebase/analytics',
];

// 1.15부터 손댄 모델은 자기 Zod 스키마를 갖고, 요청·응답 계약(@aido/api 루트·contracts)은 apis의 service·mapper만 안다.
// 용어 튜플·상수(vocabulary)와 ErrorCode(errors)는 서버와 같은 값을 쓰도록 모델에서도 import한다.
// 한꺼번에 옮기면 리뷰할 수 없어 옮긴 폴더·파일부터 이 목록에 올린다.
const CLIENT_OWNED_MODEL_PATHS = [
  'src/features/weather/components/',
  'src/features/weather/constants/',
  'src/features/weather/domains/',
  'src/features/weather/hooks/',
  'src/features/weather/queries/',
  'src/features/weather/utils/',
  'src/features/notes/memo/components/',
  'src/features/notes/memo/constants/',
  'src/features/notes/memo/domains/',
  'src/features/notes/memo/hooks/',
  'src/features/notes/memo/queries/',
  'src/features/notes/memo/utils/',
  'src/features/support/inquiry/constants/',
  'src/features/support/inquiry/hooks/',
  'src/features/support/inquiry/queries/',
  'src/features/insights/achievement/constants/',
  'src/features/insights/achievement/domains/',
  'src/features/insights/achievement/hooks/',
  'src/features/insights/achievement/queries/',
  'src/features/insights/achievement/utils/',
  'src/features/device/activation/components/',
  'src/features/device/activation/constants/',
  'src/features/device/activation/domains/',
  'src/features/device/activation/hooks/',
  'src/features/device/activation/queries/',
  'src/features/identity/preference/constants/',
  'src/features/identity/preference/domains/',
  'src/features/identity/preference/queries/',
  'src/features/identity/user/components/',
  'src/features/identity/user/constants/',
  'src/features/identity/user/domains/',
  'src/features/identity/user/hooks/',
  'src/features/identity/user/queries/',
  'src/features/identity/user/utils/',
  'src/features/identity/consent/components/',
  'src/features/identity/consent/constants/',
  'src/features/identity/consent/domains/',
  'src/features/identity/consent/hooks/',
  'src/features/identity/consent/queries/',
  'src/features/identity/auth/components/',
  'src/features/identity/auth/constants/',
  'src/features/identity/auth/domains/',
  'src/features/identity/auth/hooks/',
  'src/features/identity/auth/queries/',
  'src/features/identity/auth/utils/',
  'src/features/device/app-icon/components/',
  'src/features/device/app-icon/constants/',
  'src/features/device/app-icon/domains/',
  'src/features/device/app-icon/queries/',
  'src/features/app-config/app-version/components/',
  'src/features/app-config/app-version/domains/',
  'src/features/app-config/app-version/queries/',
  'src/features/app-config/feature-campaign/queries/',
  'src/features/app-config/whats-new/components/',
  'src/features/app-config/whats-new/constants/',
  'src/features/app-config/whats-new/domains/',
  'src/features/app-config/whats-new/hooks/',
  'src/features/device/coachmark/components/',
  'src/features/device/coachmark/constants/',
  'src/features/device/coachmark/domains/',
  'src/features/device/coachmark/hooks/',
  'src/features/notification/components/',
  'src/features/notification/constants/',
  'src/features/notification/domains/',
  'src/features/notification/hooks/',
  'src/features/notification/queries/',
  'src/features/notification/repositories/',
  'src/features/notification/services/',
  'src/features/notification/stores/',
  'src/features/notification/utils/',
  'src/features/device/store-review/constants/',
  'src/features/device/store-review/domains/',
  'src/features/device/store-review/hooks/',
  'src/features/device/store-review/utils/',
  'src/features/social/moderation/constants/',
  'src/features/social/moderation/domains/',
  'src/features/social/moderation/queries/',
  'src/features/insights/report/components/',
  'src/features/insights/report/constants/',
  'src/features/insights/report/queries/',
  'src/features/insights/report/utils/',
  'src/features/assistant/suggestion/components/',
  'src/features/assistant/suggestion/constants/',
  'src/features/assistant/suggestion/domains/',
  'src/features/assistant/suggestion/queries/',
  'src/features/social/friend/components/',
  'src/features/social/friend/constants/',
  'src/features/social/friend/domains/',
  'src/features/social/friend/queries/',
  'src/features/social/friend/utils/',
  'src/features/social/nudge/constants/',
  'src/features/social/nudge/queries/',
  'src/features/social/nudge/utils/',
  'src/features/billing/subscription/domains/customer-info\\.model\\.ts$',
  'src/features/billing/subscription/domains/entitlement\\.model\\.ts$',
  'src/features/engagement/comment/components/',
  'src/features/engagement/comment/constants/',
  'src/features/engagement/comment/domains/',
  'src/features/engagement/comment/hooks/',
  'src/features/engagement/comment/queries/',
  'src/features/engagement/comment/utils/',
  'src/features/planning/todo/components/',
  'src/features/planning/todo/constants/',
  'src/features/planning/todo/domains/',
  'src/features/planning/todo/hooks/',
  'src/features/planning/todo/queries/',
  'src/features/planning/todo/utils/',
  'src/features/planning/composer/components/',
  'src/features/planning/composer/domains/',
  'src/features/planning/composer/hooks/',
  'src/features/planning/composer/queries/',
  'src/features/planning/composer/utils/',
  'src/features/voice/domains/',
  'src/features/planning/category/components/',
  'src/features/planning/category/constants/',
  'src/features/planning/category/domains/',
  'src/features/planning/category/hooks/',
  'src/features/planning/category/queries/',
  'src/features/social/nudge/components/',
  'src/features/social/nudge/domains/',
  'src/features/social/nudge/hooks/',
  'src/features/social/invite/components/',
  'src/features/social/invite/constants/',
  'src/features/social/invite/domains/',
  'src/features/social/invite/hooks/',
  'src/features/social/invite/queries/',
  'src/features/social/invite/utils/',
];

// Zod 스키마를 domains/{entity}.model.ts와 schemas/로 옮긴 feature와 폴더
const SCHEMA_FOLDER_FEATURE_PATHS = [
  'src/features/notes/memo/',
  'src/features/voice/',
  'src/features/support/inquiry/',
  'src/features/insights/achievement/',
  'src/features/device/activation/',
  'src/features/identity/preference/',
  'src/features/identity/user/',
  'src/features/identity/consent/',
  'src/features/identity/auth/',
  'src/features/billing/subscription/apis/',
  'src/features/billing/subscription/components/',
  'src/features/billing/subscription/domains/',
  'src/features/billing/subscription/queries/',
  'src/features/billing/subscription/utils/',
  'src/features/device/app-icon/',
  'src/features/app-config/app-version/',
  'src/features/app-config/feature-campaign/',
  'src/features/app-config/whats-new/',
  'src/features/device/coachmark/',
  'src/features/weather/',
  'src/features/notification/',
  'src/features/device/store-review/',
  'src/features/planning/category/',
  'src/features/social/nudge/',
  'src/features/social/invite/',
  'src/features/planning/todo/',
  'src/features/planning/composer/',
  'src/features/social/moderation/apis/',
  'src/features/social/moderation/components/',
  'src/features/social/moderation/constants/',
  'src/features/social/moderation/domains/',
  'src/features/social/moderation/hooks/',
  'src/features/social/moderation/queries/',
  'src/features/insights/report/apis/',
  'src/features/insights/report/components/',
  'src/features/insights/report/constants/',
  'src/features/insights/report/queries/',
  'src/features/insights/report/utils/',
  'src/features/assistant/suggestion/apis/',
  'src/features/assistant/suggestion/components/',
  'src/features/assistant/suggestion/constants/',
  'src/features/assistant/suggestion/queries/',
  'src/features/social/friend/apis/',
  'src/features/social/friend/components/',
  'src/features/social/friend/constants/',
  'src/features/social/friend/queries/',
  'src/features/social/friend/utils/',
  'src/features/engagement/comment/apis/',
  'src/features/engagement/comment/components/',
  'src/features/engagement/comment/constants/',
  'src/features/engagement/comment/domains/',
  'src/features/engagement/comment/hooks/',
  'src/features/engagement/comment/queries/',
  'src/features/engagement/comment/utils/',
];

// 지금 시각·기기 시간대를 읽는 모듈. 모델과 mapper는 시각을 인자로 받는다
const CLOCK =
  '^src/shared/date/clock\\.ts$|^src/shared/hooks/use-(?:now|minute-now|today)\\.ts$|^src/shared/infra/localization/device-timezone\\.ts$';

function featureFolders(folders) {
  return `^src/features/.+/(?:${folders.join('|')})/`;
}

// 남은 위반은 .dependency-cruiser-known-violations.json(baseline #1400)에 있고 lint:deps가 --ignore-known으로 건너뛴다
const modelAndFolderRules = [
  {
    name: 'domain-model-constants',
    comment:
      '도메인 모델은 기능 constants/를 import하지 않는다. 업무 규칙 표는 모델에 두고, constants/는 시간·한도·id·이벤트·로그 키만 둔다.',
    severity: 'error',
    from: { path: DOMAIN_MODEL },
    to: { path: featureFolders(['constants']) },
  },
  {
    name: 'domain-model-clock',
    comment:
      '도메인 모델은 시계·기기 시간대를 읽지 않는다. 지금·오늘·시간대는 인자(now, today, timeZone)로 받는다.',
    severity: 'error',
    from: { path: DOMAIN_MODEL },
    to: { path: CLOCK },
  },
  {
    name: 'mapper-purity',
    comment:
      'mapper는 순수 함수다. 로그·보고·추적 포트, shared/infra 어댑터, 시계를 import하지 않는다. OS·SDK 값의 타입을 정의한 포트(push-notification-gateway 등)는 바꿀 대상이라 가져와도 된다.',
    severity: 'error',
    from: { path: '[^/]+\\.mapper\\.tsx?$', pathNot: TEST },
    to: {
      path: [
        '^src/core/ports/(?:logger|error-reporter|analytics)\\.ts$',
        '^src/shared/infra/',
        CLOCK,
      ],
    },
  },
  {
    name: 'api-folder-dependency',
    comment:
      'apis/의 Api·mapper는 서버 호출과 변환만 한다. repositories/·services/·stores/를 import하지 않는다. 조율은 services/가 Api를 받아 한다.',
    severity: 'error',
    from: { path: featureFolders(['apis']), pathNot: TEST },
    to: { path: featureFolders(['repositories', 'services', 'stores']) },
  },
  {
    name: 'repository-folder-dependency',
    comment:
      'repository는 저장 포트·storage 스키마·Logger만 쓴다. apis/·services/를 import하지 않는다.',
    severity: 'error',
    from: { path: featureFolders(['repositories']), pathNot: TEST },
    to: { path: featureFolders(['apis', 'services']) },
  },
];

function featuresAbove(layer) {
  return Object.keys(FEATURE_LAYERS).filter((feature) => FEATURE_LAYERS[feature] > layer);
}

function featuresAt(layer) {
  return Object.keys(FEATURE_LAYERS).filter((feature) => FEATURE_LAYERS[feature] === layer);
}

const upwardRules = [1, 2, 3].map((layer) => ({
  name: `feature-upward-from-layer-${layer}`,
  comment:
    '위층 feature의 코드를 import한다. 위층에서 가져와도 되는 것은 타입, 모델(Policy), *-cache다. app/에서 조립하거나 슬롯으로 넘긴다.',
  severity: 'error',
  from: { path: `^src/features/(?:${featuresAt(layer).join('|')})/`, pathNot: TEST },
  to: {
    path: `^src/features/(?:${featuresAbove(layer).join('|')})/`,
    pathNot: ANY_LAYER,
    dependencyTypesNot: ['type-only'],
  },
}));

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-layer',
      comment:
        'core는 shared·feature·bootstrap을 import하지 않는다. 포트와 타입을 core로 옮기거나 값을 인자로 받는다.',
      severity: 'error',
      from: { path: '^src/core/', pathNot: TEST },
      to: { path: '^src/(?:shared|features|bootstrap)/' },
    },
    {
      name: 'shared-layer',
      comment:
        'shared는 feature·bootstrap을 import하지 않는다. 포트와 타입을 core로 옮기거나 값을 인자로 받는다.',
      severity: 'error',
      from: { path: '^src/shared/', pathNot: TEST },
      to: { path: '^src/(?:features|bootstrap)/' },
    },
    ...upwardRules,
    {
      name: 'testing-from-production',
      comment:
        'src/testing은 테스트에서만 import한다. 운영 코드가 테스트 stub·fake·mock을 가져오면 번들에 섞이고 층 규칙이 무너진다.',
      severity: 'error',
      from: { path: '^(?:src|app)/', pathNot: TEST },
      to: { path: '^src/testing/' },
    },
    {
      name: 'feature-unknown-layer',
      comment:
        '층이 정해지지 않은 feature다. scripts/feature-graph.cjs의 FEATURE_LAYERS와 .claude/architecture.md의 층 표에 더한다.',
      severity: 'error',
      from: { path: FEATURE, pathNot: [KNOWN_FEATURE, TEST] },
      to: { path: '^src/features/', pathNot: '^src/features/$1/' },
    },
    {
      name: 'feature-unknown-layer-target',
      comment:
        '층이 정해지지 않은 feature다. scripts/feature-graph.cjs의 FEATURE_LAYERS와 .claude/architecture.md의 층 표에 더한다.',
      severity: 'error',
      from: { path: FEATURE, pathNot: TEST },
      to: { path: '^src/features/', pathNot: ['^src/features/$1/', KNOWN_FEATURE] },
    },
    {
      name: 'feature-relative-import',
      comment:
        '다른 feature는 상대 경로가 아니라 @src/features/… 경로로 import한다. feature 경계가 검색과 리뷰에서 드러나야 한다.',
      severity: 'error',
      from: { path: FEATURE },
      to: {
        path: '^src/features/',
        pathNot: '^src/features/$1/',
        dependencyTypes: ['local'],
        dependencyTypesNot: ['aliased'],
      },
    },
    {
      name: 'feature-own-absolute-import',
      comment: '자기 feature는 @src/features 절대 경로가 아니라 상대 경로로 import한다.',
      severity: 'error',
      from: { path: FEATURE },
      to: { path: '^src/features/$1/', dependencyTypes: ['aliased'] },
    },
    {
      name: 'sdk-outside-infra',
      comment:
        'SDK는 shared/infra에서만 import한다. 포트와 어댑터를 거쳐 DI 훅으로 받는다. 라이브러리가 React 훅이면 경계 훅 파일 하나에 둔다(.claude/architecture.md#portadapterdi).',
      severity: 'error',
      from: { path: '^(?:src|app)/', pathNot: ['^src/shared/infra/', TEST] },
      to: { path: npm(SDK_MODULES) },
    },
    {
      name: 'es-toolkit-compat',
      comment:
        "es-toolkit/compat 대신 메인 'es-toolkit'을 쓴다. times는 range(n).map으로 바꾼다. compat은 메인에 없는 기능만 이유와 함께 허용한다.",
      severity: 'error',
      // 메인 debounce에는 maxWait이 없어 입력이 계속돼도 초안이 저장되도록 compat을 쓴다
      from: {
        path: '^(?:src|app)/',
        pathNot: '^src/features/voice/apis/voice-note-draft\\.repository\\.ts$',
      },
      to: { path: '(?:^|/node_modules/)es-toolkit/(?:dist/)?compat(?:/|\\.|$)' },
    },
    {
      name: 'date-library-dayjs',
      comment:
        'dayjs를 쓰지 않는다. 날짜 값은 shared/date의 Instant·날짜 key·TimeOfDay, 계산은 shared/date다.',
      severity: 'error',
      from: { path: '^(?:src|app)/' },
      to: { path: npm(['dayjs']) },
    },
    {
      name: 'date-library-temporal',
      comment:
        'temporal-polyfill을 쓰지 않는다(Hermes 바이트코드 +137KB, 시간대 이름 대문자 문제). 날짜 key는 shared/date의 순수 계산, 시간대는 Intl이다.',
      severity: 'error',
      from: { path: '^(?:src|app)/' },
      to: { path: npm(['temporal-polyfill']) },
    },
    {
      name: 'di-entry',
      comment:
        'feature와 app/은 DI 훅을 @src/bootstrap/providers/di-context에서 꺼낸다. 빠진 훅은 di-context가 다시 내보내게 한다.',
      severity: 'error',
      from: { path: '^(?:src/features|app)/', pathNot: TEST },
      to: { path: '^src/shared/di/shared-di-context\\.tsx?$' },
    },
    {
      name: 'domain-model-contract',
      comment:
        '도메인 모델은 요청·응답 계약(@aido/api 루트·contracts)을 import하지 않는다. 모델이 자기 Zod 스키마를 갖고 apis/*.mapper.ts가 DTO를 모델로 바꾼다. 용어 튜플·상수는 @aido/api/vocabulary, 오류 코드는 @aido/api/errors에서 가져온다.',
      severity: 'error',
      from: { path: DOMAIN_MODEL },
      to: { path: WIRE_CONTRACT },
    },
    {
      name: 'domain-model-presentation',
      comment:
        '도메인 모델은 문구(i18n), 화면 부품(shared/ui), 플랫폼(react-native), React를 import하지 않는다. 모델과 Policy는 업무 규칙만 두고 문구·화면·플랫폼 값은 view-model·컴포넌트·어댑터가 맡는다.',
      severity: 'error',
      from: { path: DOMAIN_MODEL },
      to: {
        path: [
          '^src/shared/(?:i18n|ui)(?:/|\\.tsx?$)',
          npm(['i18next', 'react-i18next', 'react-native', 'react']),
        ],
      },
    },
    {
      name: 'client-model-contract',
      comment:
        '클라이언트 모델은 요청·응답 계약(@aido/api 루트·contracts)을 import하지 않는다. apis/*.mapper.ts가 DTO를 모델로 바꿔야 서버가 바뀌어도 mapper만 고친다. 용어 튜플·상수는 @aido/api/vocabulary, 오류 코드는 @aido/api/errors에서 가져온다.',
      severity: 'error',
      from: { path: paths(CLIENT_OWNED_MODEL_PATHS), pathNot: ['\\.test\\.', DOMAIN_MODEL] },
      to: { path: WIRE_CONTRACT },
    },
    {
      name: 'zod-outside-schemas',
      comment:
        'Zod 스키마는 클라이언트 모델이면 domains/{entity}.model.ts, 폼·route·초안·서버와 공유하는 요청 타입이면 schemas/에 둔다.',
      severity: 'error',
      from: {
        path: paths(SCHEMA_FOLDER_FEATURE_PATHS),
        pathNot: [TEST, '/schemas/', DOMAIN_MODEL],
      },
      to: { path: npm(['zod']) },
    },
    {
      name: 'cache-helper-purity',
      comment:
        '캐시 helper(queries/*-cache.ts)는 Query 캐시만 만진다. 이벤트 발행(core/events)·오류 보고·로그·Api·Service 호출은 호출부(mutation)에서 한다.',
      severity: 'error',
      from: { path: '/queries/[^/]+-cache\\.ts$', pathNot: TEST },
      to: {
        path: '^src/core/events/|/(?:apis|services)/[^/]+\\.(?:api|service)\\.tsx?$|/ports/(?:error-reporter|logger)\\.tsx?$',
      },
    },
    ...modelAndFolderRules,
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['react-native', 'types', 'import', 'require', 'default'],
      // Metro가 고르는 플랫폼 파일도 풀어 import가 끊기지 않게 한다
      extensions: [
        '.ts',
        '.tsx',
        '.ios.ts',
        '.ios.tsx',
        '.android.ts',
        '.android.tsx',
        '.js',
        '.jsx',
        '.json',
      ],
    },
  },
};
