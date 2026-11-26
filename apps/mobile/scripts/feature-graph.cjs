// feature 층 표와 dependency-cruiser 리포터. 규칙(.dependency-cruiser.cjs)과 리포터가 같은 표를 읽는다.
// 모듈 import 규칙은 dependency-cruiser가 보고, 이 리포터는 규칙으로 쓸 수 없는 feature 그래프만 본다:
// di-context 훅이 돌려주는 값의 주인 feature, 두 feature가 서로 import하는 쌍, 컴포넌트·훅 하나만 쓰는 파일(경고).
//   depcruise src app --config .dependency-cruiser.cjs --output-type plugin:$PWD/scripts/feature-graph.cjs
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

// 서버 모듈 이름의 업무 영역. 이 아래는 `영역/기능` 두 단계, 나머지는 한 단계 feature다
const FEATURE_AREAS = [
  'app-config',
  'assistant',
  'billing',
  'device',
  'engagement',
  'identity',
  'insights',
  'notes',
  'planning',
  'social',
  'support',
];

// 층이 낮을수록 아래다. core·shared(0)가 맨 아래, app·bootstrap이 맨 위다. 근거는 docs/architecture/structure.md#층과-의존
const FEATURE_LAYERS = {
  'identity/auth': 1,
  'identity/user': 1,
  'identity/preference': 1,
  'identity/consent': 1,
  'billing/subscription': 1,
  'support/inquiry': 1,
  'app-config/app-version': 1,
  'device/app-icon': 1,
  'planning/todo': 2,
  'planning/category': 2,
  'device/coachmark': 2,
  'device/store-review': 2,
  voice: 3,
  'planning/todo-import': 3,
  'engagement/comment': 3,
  'social/friend': 3,
  'social/nudge': 3,
  'social/moderation': 3,
  'assistant/suggestion': 3,
  'insights/achievement': 3,
  'insights/report': 3,
  'app-config/whats-new': 3,
  'device/widget': 3,
  'planning/composer': 4,
  'notes/memo': 4,
  weather: 4,
  notification: 4,
  'social/invite': 4,
  'device/activation': 4,
};

// 끊지 못한 양방향 쌍과 이유. 새 쌍은 막고, 사라진 쌍은 목록에서 지우라고 실패한다
const ALLOWED_FEATURE_CYCLES = {
  'planning/category <-> planning/todo':
    'todo→category는 할 일 화면이 카테고리 조회, 부품, 스키마, 캐시를 쓴다. category→todo는 카테고리 변경 뒤 todo-cache 갱신이다. 변경마다 다시 받는 범위가 달라(추가·삭제는 할 일 전체, 이름·색은 목록과 완료 통계, 순서는 위젯 요약) meta 태그 하나로 묶으면 다시 받는 범위가 바뀌고, 이벤트는 갱신을 mutation 밖으로 숨겨 남긴다',
};

const FEATURE_PATTERN = `(?:${FEATURE_AREAS.join('|')})/[^/]+|[^/]+`;
const FEATURE_PATH = new RegExp(`^src/features/(${FEATURE_PATTERN})/`, 'u');
const TEST_PATH = /\.(?:spec|test)\.[cm]?[jt]sx?$|\/__tests__\//u;
const DI_CONTEXT_FILE = 'src/bootstrap/providers/di-context.tsx';
const DI_CONTEXT_MODULE = '@src/bootstrap/providers/di-context';

function getFeatureName(path) {
  return FEATURE_PATH.exec(path)?.[1] ?? null;
}

function loadTypeScript() {
  return require('typescript');
}

/** `return useDI().field` 한 줄이면 field, 아니면 null */
function getReturnedDiField(ts, declaration) {
  const statements = declaration.body?.statements ?? [];
  const [statement] = statements;
  if (
    statements.length !== 1 ||
    !ts.isReturnStatement(statement) ||
    statement.expression == null ||
    !ts.isPropertyAccessExpression(statement.expression)
  ) {
    return null;
  }
  const { expression, name } = statement.expression;
  return ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'useDI'
    ? name.text
    : null;
}

function parse(ts, path) {
  return ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function getLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/**
 * di-context의 `use{X}` 훅이 돌려주는 값의 주인 feature. `DIContainer` 필드 타입을 import한 경로에서 읽어
 * 컨테이너가 바뀌면 함께 바뀐다. 주인이 feature가 아니면(core·shared·bootstrap) 담지 않는다
 */
function loadDiHookOwners(ts, root, errors) {
  const sourceFile = parse(ts, resolve(root, DI_CONTEXT_FILE));
  const typeModules = new Map();
  const fieldTypes = new Map();
  const hookFields = new Map();
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings != null && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          typeModules.set(element.name.text, statement.moduleSpecifier.text);
        }
      }
    } else if (ts.isInterfaceDeclaration(statement) && statement.name.text === 'DIContainer') {
      for (const member of statement.members) {
        if (
          ts.isPropertySignature(member) &&
          ts.isIdentifier(member.name) &&
          member.type != null &&
          ts.isTypeReferenceNode(member.type) &&
          ts.isIdentifier(member.type.typeName)
        ) {
          fieldTypes.set(member.name.text, member.type.typeName.text);
        }
      }
    } else if (
      ts.isFunctionDeclaration(statement) &&
      statement.name != null &&
      /^use[A-Z]/u.test(statement.name.text) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      const field = getReturnedDiField(ts, statement);
      if (field == null) {
        errors.push(
          `${DI_CONTEXT_FILE}:${getLine(sourceFile, statement)} di-context의 ${statement.name.text}는 \`return useDI().필드\` 한 줄로 씁니다. 층 검사가 돌려주는 값의 주인을 읽어야 합니다.`,
        );
      } else {
        hookFields.set(statement.name.text, field);
      }
    }
  }
  const owners = new Map();
  for (const [hook, field] of hookFields) {
    const moduleName = typeModules.get(fieldTypes.get(field)) ?? '';
    const owner = moduleName.startsWith('@src/features/')
      ? getFeatureName(`src/features/${moduleName.slice('@src/features/'.length)}`)
      : null;
    if (owner != null) {
      owners.set(hook, owner);
    }
  }
  return owners;
}

/** 타입이 아닌 이름으로 가져온 DI 훅과 그 줄 */
function getDiHookImports(ts, path) {
  const sourceFile = parse(ts, path);
  return sourceFile.statements.flatMap((statement) => {
    const clause = ts.isImportDeclaration(statement) ? statement.importClause : undefined;
    if (
      clause == null ||
      clause.isTypeOnly ||
      statement.moduleSpecifier.text !== DI_CONTEXT_MODULE ||
      clause.namedBindings == null ||
      !ts.isNamedImports(clause.namedBindings)
    ) {
      return [];
    }
    return clause.namedBindings.elements
      .filter((element) => !element.isTypeOnly)
      .map((element) => ({
        hook: (element.propertyName ?? element.name).text,
        line: getLine(sourceFile, statement),
      }));
  });
}

function checkFeatureGraph(modules, root) {
  const errors = [];
  const ts = loadTypeScript();
  const diHookOwners = loadDiHookOwners(ts, root, errors);
  const edges = new Map();
  const addEdge = (owner, target) => {
    if (!edges.has(owner)) {
      edges.set(owner, new Set());
    }
    edges.get(owner).add(target);
  };

  for (const module of modules) {
    const owner = getFeatureName(module.source);
    if (owner == null || TEST_PATH.test(module.source)) {
      continue;
    }
    for (const dependency of module.dependencies) {
      const target = getFeatureName(dependency.resolved);
      if (target != null && target !== owner) {
        addEdge(owner, target);
      }
    }
    const usesDiContext = module.dependencies.some(
      (dependency) =>
        dependency.resolved === DI_CONTEXT_FILE &&
        !dependency.dependencyTypes.includes('type-only'),
    );
    if (!usesDiContext) {
      continue;
    }
    for (const { hook, line } of getDiHookImports(ts, resolve(root, module.source))) {
      const target = diHookOwners.get(hook);
      if (target == null || target === owner) {
        continue;
      }
      addEdge(owner, target);
      const location = `${module.source}:${line}`;
      const ownerLayer = FEATURE_LAYERS[owner];
      const targetLayer = FEATURE_LAYERS[target];
      if (ownerLayer == null || targetLayer == null) {
        errors.push(
          `${location} ${ownerLayer == null ? owner : target}의 층이 정해지지 않았습니다. scripts/feature-graph.cjs의 FEATURE_LAYERS와 docs/architecture/structure.md의 층 표에 더하세요.`,
        );
      } else if (ownerLayer < targetLayer) {
        errors.push(
          `${location} 위층 ${target}의 값을 ${hook}로 꺼냅니다. 위층의 Service·저장소는 쓰지 않습니다. 이벤트로 알리거나 app/에서 조립해 인자로 넘기세요.`,
        );
      }
    }
  }

  const cycles = new Set();
  for (const [owner, targets] of edges) {
    for (const target of targets) {
      if (owner < target && edges.get(target)?.has(owner)) {
        cycles.add(`${owner} <-> ${target}`);
      }
    }
  }
  for (const cycle of cycles) {
    if (!(cycle in ALLOWED_FEATURE_CYCLES)) {
      errors.push(
        `${cycle}: 두 feature가 서로 import합니다. 한쪽을 끊거나 이유를 적어 scripts/feature-graph.cjs의 ALLOWED_FEATURE_CYCLES에 더하세요.`,
      );
    }
  }
  for (const cycle of Object.keys(ALLOWED_FEATURE_CYCLES)) {
    if (!cycles.has(cycle)) {
      errors.push(
        `${cycle}: 이제 서로 import하지 않습니다. scripts/feature-graph.cjs의 ALLOWED_FEATURE_CYCLES에서 지우세요.`,
      );
    }
  }
  for (const members of findLongFeatureCycles(edges)) {
    errors.push(
      `${members.join(', ')}: 세 feature 이상이 돌아서 서로 import합니다. 공용 값은 shared로 내리거나 슬롯·인자로 받아 한쪽을 끊으세요.`,
    );
  }
  return errors;
}

/**
 * 세 feature 이상이 도는 고리(강하게 연결된 묶음, Tarjan). 두 feature가 서로 import하는 쌍은 위에서 따로 보고
 * ALLOWED_FEATURE_CYCLES로 허용하므로 여기서는 셋 이상인 묶음만 낸다
 */
function findLongFeatureCycles(edges) {
  const order = new Map();
  const lowest = new Map();
  const stack = [];
  const onStack = new Set();
  const groups = [];
  const visit = (feature) => {
    order.set(feature, order.size);
    lowest.set(feature, order.get(feature));
    stack.push(feature);
    onStack.add(feature);
    for (const target of edges.get(feature) ?? []) {
      if (!order.has(target)) {
        visit(target);
        lowest.set(feature, Math.min(lowest.get(feature), lowest.get(target)));
      } else if (onStack.has(target)) {
        lowest.set(feature, Math.min(lowest.get(feature), order.get(target)));
      }
    }
    if (lowest.get(feature) !== order.get(feature)) {
      return;
    }
    const group = [];
    let member = null;
    while (member !== feature) {
      member = stack.pop();
      onStack.delete(member);
      group.push(member);
    }
    groups.push(group.sort());
  };
  for (const feature of edges.keys()) {
    if (!order.has(feature)) {
      visit(feature);
    }
  }
  return groups.filter((group) => group.length >= 3);
}

const LOCAL_ONLY_CANDIDATE = /^src\/features\/.+\/(?:components|hooks)\/.+\.tsx?$/u;
// route·bootstrap이 쓰는 파일은 기능의 공개 면이라 따로 둔다. 컴포넌트·훅 하나만 쓰면 그 파일의 지역 조각이다
const COMPONENT_OR_HOOK_IMPORTER = /^src\/(?:features|shared)\/.+\/(?:components|hooks)\//u;
// 한 파일만 쓰지만 따로 두는 파일과 이유. 새 파일은 경고하고, 더는 해당하지 않는 파일은 목록에서 지우라고 실패한다.
// `/`로 끝나는 항목은 그 폴더 아래 전부다. 같은 이유로 따로 두는 파일 묶음(Skia 장면 레이어)을 한 줄로 적는다
const ALLOWED_LOCAL_ONLY_FILES = {
  'src/features/app-config/whats-new/components/calendar-import-demo.tsx':
    '1.17.0 소개(release-1-17-0-steps)만 쓴다. 캘린더 가져오기의 실제 부품을 예시 값으로 움직이는 장면 묶음이고, 소개를 지울 때 함께 지운다(docs/whats-new-release.md)',
  'src/features/app-config/whats-new/components/report-demo.tsx':
    '1.16.0 소개(release-1-16-0-steps)만 쓴다. 리포트의 실제 차트·머리말·코치 카드를 예시 값으로 그리는 장면 묶음이고, 소개를 지울 때 함께 지운다(docs/whats-new-release.md)',
  'src/features/app-config/whats-new/components/suggestion-demo.tsx':
    '1.16.0 소개(release-1-16-0-steps)만 쓴다. AI 제안의 실제 줄·상태 카드를 예시 값으로 그리는 장면 묶음이고, 소개를 지울 때 함께 지운다(docs/whats-new-release.md)',
  'src/features/weather/components/weather-scene-canvas/':
    '하늘 장면(weather-scene-canvas)과 그 레이어(구름·비·눈·번개·밤하늘 등)다. 레이어마다 셰이더·입자·경로 수명을 스스로 갖는 완결된 Skia 그리기 부품이고 Canvas 안에서 도는 코드라, 장면 파일에 합치면 3,000줄이 넘는다',
  'src/features/insights/report/components/completion-trend-line.tsx':
    '리포트 목록의 최근 카드만 쓴다. 주별 완료율을 받은 값만으로 그리는 스스로 완결된 Skia 추세선 차트(경로 수명·밀기·접근성 조절)라 목록 파일에 합치면 900줄이 넘는다',
  'src/features/weather/components/weather-dial.tsx':
    '상세 격자만 쓴다. 나침반·기압계를 받은 값만으로 그리는 스스로 완결된 SVG 다이얼이다',
  'src/features/weather/components/weather-sun-moon/weather-sun-arc.tsx':
    '해와 달 카드만 쓴다. 해의 길과 지금 위치를 받은 값만으로 그리는 스스로 완결된 차트다',
  'src/features/weather/components/weather-sun-moon/weather-moon-icon.tsx':
    '해와 달 카드만 쓴다. 달의 위상을 받은 값만으로 그리는 스스로 완결된 그림이다',
  'src/features/engagement/comment/components/todo-comment-thread-list.tsx':
    '상세 칸(todo-comment-pane)만 쓴다. 칸은 세션·경계·작성 바 조립이고 이 파일은 목록·정렬·묶음·답글·키보드 스크롤이라, 합치면 한 파일이 1,000줄을 넘어 위에서 아래로 읽히지 않는다',
  'src/features/engagement/comment/components/todo-comment-item.tsx':
    '묶음 목록만 쓴다. 댓글·답글 두 단이 함께 쓰는 행(연결선·본문·메뉴·하트·스크린리더 동작)이라 목록에 합치면 한 파일이 1,500줄을 넘는다',
  'src/features/engagement/comment/components/todo-comment-heart-burst.tsx':
    '댓글 행만 쓴다. shared value와 animated style만으로 도는 스스로 완결된 그리기 부품이다(docs/todo-comments.md의 더블탭 하트)',
  'src/features/notes/memo/components/scroll-progress-widget.tsx':
    '메모 목록만 쓴다. Skia 캔버스·제스처·shared value로 스크롤 위치를 그리고 맨 위로 보내는 스스로 완결된 그리기 부품이라, 카드 목록·순서 애니메이션을 가진 목록에 합치면 한 파일이 900줄을 넘고 두 가지 일이 섞인다',
  'src/features/planning/todo/components/calendar/calendar-title-bar.tsx':
    '피드 달력만 쓴다. 가장 긴 제목을 그리기 전에 재어 한 줄·두 줄 배치를 정하는 측정 부품이라, 쪽 넘김·칸을 가진 달력에 합치면 한 파일이 800줄에 가깝고 두 가지 일이 섞인다',
  'src/features/planning/todo/components/todo-detail-schedule.tsx':
    '할 일 상세 요약(engagement/comment)만 쓴다. 할 일의 view-model(시간·기간·반복 문구)로 그리는 조각이라 그 기능 파일로 옮기면 다른 기능의 utils를 import하게 된다',
  'src/features/notification/components/todo-time-push-notice.tsx':
    '할 일 작성 칩(planning/composer)만 쓴다. 알림 권한 조회와 권한 단계(usePushPermissionAction)로 그리는 조각이라 그 기능 파일로 옮기면 작성기가 알림 기능의 권한 조회·단계를 직접 갖게 된다',
  'src/features/planning/todo/components/todo-schedule-summary.tsx':
    '계획 검토 카드(voice)만 쓴다. 할 일의 view-model(기간·시각·반복 문구)로 그리는 조각이라 음성 파일로 옮기면 다른 기능의 utils를 import하게 된다',
  'src/features/voice/components/dictation-button.tsx':
    '할 일 작성 시트(planning/composer)의 하위 할 일 시트가 쓴다. 음성 기능 밖에서 import하는 파일이다',
  'src/features/voice/components/quick-voice-button.tsx':
    '할 일 작성 시트(planning/composer)의 할 일 만들기 시트가 쓴다. 음성 기능 밖에서 import하는 파일이다',
  'src/features/voice/components/sheet-edge-glow.tsx':
    '할 일 작성 시트(planning/composer)의 할 일 만들기 시트가 쓴다. 음성 기능 밖에서 import하는 파일이고, 음량을 UI 스레드에서 읽어 그리는 Skia 부품이다',
  'src/features/voice/hooks/use-continue-as-voice-note.ts':
    '할 일 작성 시트(planning/composer)의 빠른 말하기 훅이 쓴다. 음성 기능 밖에서 import하는 파일이다',
  'src/features/voice/hooks/use-quick-plan-request.ts':
    '할 일 작성 시트(planning/composer)의 빠른 말하기 훅이 쓴다. 음성 기능 밖에서 import하는 파일이다',
  'src/features/voice/components/voice-visual.tsx':
    '빠른 말하기 듣기 단계만 쓴다. 셰이더 구슬과 막대를 프레임 콜백으로 그리는 스스로 완결된 Skia 부품이다',
  'src/features/voice/components/digest-scan-preview.tsx':
    '정리 중 화면만 쓴다. 훑는 빛줄기를 그리는 스스로 완결된 Skia 부품이다',
  'src/features/voice/components/voice-note-recorder/recognizer-waveform.tsx':
    '녹음 화면만 쓴다. 음량 파형과 중요 표시 깃발을 프레임 콜백으로 그리는 스스로 완결된 Skia 부품이다',
  'src/features/voice/components/voice-note-recorder/recording-timer.tsx':
    '녹음 화면만 쓴다. 창 높이로 정한 고리 크기와 줄어드는 글자를 SVG로 그리는 스스로 완결된 그리기 부품이다',
};

/** 운영 importer가 컴포넌트·훅 하나뿐이고 자체 테스트가 없는 기능 components/·hooks/ 파일과 그 importer */
function listLocalOnlyFiles(modules) {
  return modules.flatMap((module) => {
    if (!LOCAL_ONLY_CANDIDATE.test(module.source) || TEST_PATH.test(module.source)) {
      return [];
    }
    const dependents = module.dependents ?? [];
    if (dependents.some((dependent) => TEST_PATH.test(dependent))) {
      return [];
    }
    return dependents.length === 1 && COMPONENT_OR_HOOK_IMPORTER.test(dependents[0])
      ? [{ source: module.source, importer: dependents[0] }]
      : [];
  });
}

/** 이유를 적은 항목이 그 파일을 가리키는가. `/`로 끝나는 항목은 그 폴더 아래 파일 전부를 가리킨다 */
function isAllowedBy(allowance, source) {
  return allowance.endsWith('/') ? source.startsWith(allowance) : source === allowance;
}

/**
 * 한 곳만 쓰는데 따로 둔 파일(경고). 이유를 적어 둔 파일(`allowed`)은 뺀다.
 * 한 곳만 쓰는 조각은 쓰는 파일 안에 둔다(docs/architecture/ui.md#네임스페이스지역-컴포넌트)
 */
function findLocalOnlyFiles(modules, allowed = ALLOWED_LOCAL_ONLY_FILES) {
  const allowances = Object.keys(allowed);
  return listLocalOnlyFiles(modules)
    .filter(({ source }) => !allowances.some((allowance) => isAllowedBy(allowance, source)))
    .map(
      ({ source, importer }) =>
        `${source}: ${importer} 하나만 씁니다. 그 파일의 지역 컴포넌트·훅이나 네임스페이스 조각으로 옮기세요.`,
    );
}

/**
 * 이유를 적어 둔 파일이 더는 한 곳만 쓰는 파일이 아니면(쓰는 곳이 늘었거나 자체 테스트가 생겼거나 사라졌으면) 지우게 한다.
 * 폴더 항목은 그 아래에 한 곳만 쓰는 파일이 하나도 남지 않았을 때 낡은 것이다
 */
function findStaleLocalOnlyAllowances(modules, allowed = ALLOWED_LOCAL_ONLY_FILES) {
  const localOnly = listLocalOnlyFiles(modules).map(({ source }) => source);
  return Object.keys(allowed)
    .filter((allowance) => !localOnly.some((source) => isAllowedBy(allowance, source)))
    .map(
      (allowance) =>
        `${allowance}: 이제 컴포넌트·훅 하나만 쓰는 파일이 아닙니다. scripts/feature-graph.cjs의 ALLOWED_LOCAL_ONLY_FILES에서 지우세요.`,
    );
}

function formatViolation({ rule, from, to }, comments) {
  const comment = comments.get(rule.name);
  return `  ${rule.severity} ${rule.name}: ${from} → ${to}${comment == null ? '' : `\n    ${comment}`}`;
}

/** dependency-cruiser 리포터. 규칙 위반과 feature 그래프 위반을 함께 내고 하나라도 있으면 실패한다. 지역 파일 경고는 실패시키지 않고, 낡은 예외만 실패시킨다 */
function report(result) {
  const { modules, summary } = result;
  // 리포터 등록 때 dependency-cruiser가 빈 결과로 한 번 불러 모양을 확인한다
  if (modules.length === 0) {
    return { output: '', exitCode: 0 };
  }
  const comments = new Map(
    (summary.ruleSetUsed?.forbidden ?? []).map((rule) => [rule.name, rule.comment]),
  );
  const violations = summary.violations.filter(({ rule }) => rule.severity !== 'ignore');
  const graphErrors = checkFeatureGraph(modules, process.cwd());
  const staleAllowances = findStaleLocalOnlyAllowances(modules);
  const warnings = findLocalOnlyFiles(modules).map(
    (warning) => `  warn local-only-file: ${warning}`,
  );
  const lines = [
    ...violations.map((violation) => formatViolation(violation, comments)),
    ...graphErrors.map((error) => `  error feature-graph: ${error}`),
    ...staleAllowances.map((error) => `  error local-only-file: ${error}`),
  ];
  const total = violations.length + graphErrors.length + staleAllowances.length;
  const stats = `${summary.totalCruised} modules, ${summary.totalDependenciesCruised} dependencies cruised`;
  const warningOutput = warnings.length === 0 ? '' : `${warnings.join('\n')}\n\n`;
  return total === 0
    ? { output: `${warningOutput}✔ no dependency violations found (${stats})\n`, exitCode: 0 }
    : {
        output: `${warningOutput}${lines.join('\n')}\n\n✘ ${total} dependency violations (${stats})\n`,
        exitCode: 1,
      };
}

module.exports = report;
module.exports.FEATURE_LAYERS = FEATURE_LAYERS;
module.exports.FEATURE_PATTERN = FEATURE_PATTERN;
module.exports.findLocalOnlyFiles = findLocalOnlyFiles;
module.exports.findLongFeatureCycles = findLongFeatureCycles;
module.exports.findStaleLocalOnlyAllowances = findStaleLocalOnlyAllowances;
