// feature 층 표와 dependency-cruiser 리포터. 규칙(.dependency-cruiser.cjs)과 리포터가 같은 표를 읽는다.
// 모듈 import 규칙은 dependency-cruiser가 보고, 이 리포터는 규칙으로 쓸 수 없는 feature 그래프만 본다:
// di-context 훅이 돌려주는 값의 주인 feature, 두 feature가 서로 import하는 쌍.
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

// 층이 낮을수록 아래다. core·shared(0)가 맨 아래, app·bootstrap이 맨 위다. 근거는 .claude/architecture.md#층과-의존
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
          `${location} ${ownerLayer == null ? owner : target}의 층이 정해지지 않았습니다. scripts/feature-graph.cjs의 FEATURE_LAYERS와 .claude/architecture.md의 층 표에 더하세요.`,
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
  return errors;
}

function formatViolation({ rule, from, to }, comments) {
  const comment = comments.get(rule.name);
  return `  ${rule.severity} ${rule.name}: ${from} → ${to}${comment == null ? '' : `\n    ${comment}`}`;
}

/** dependency-cruiser 리포터. 규칙 위반과 feature 그래프 위반을 함께 내고 하나라도 있으면 실패한다 */
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
  const lines = [
    ...violations.map((violation) => formatViolation(violation, comments)),
    ...graphErrors.map((error) => `  error feature-graph: ${error}`),
  ];
  const total = violations.length + graphErrors.length;
  const stats = `${summary.totalCruised} modules, ${summary.totalDependenciesCruised} dependencies cruised`;
  return total === 0
    ? { output: `✔ no dependency violations found (${stats})\n`, exitCode: 0 }
    : {
        output: `${lines.join('\n')}\n\n✘ ${total} dependency violations (${stats})\n`,
        exitCode: 1,
      };
}

module.exports = report;
module.exports.FEATURE_AREAS = FEATURE_AREAS;
module.exports.FEATURE_LAYERS = FEATURE_LAYERS;
module.exports.FEATURE_PATTERN = FEATURE_PATTERN;
