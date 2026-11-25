import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { getCalleeName, getKeyName, topLevelDeclarations, unwrap } from '../ast.mjs';

const EVENT_VERBS = [
  'shown',
  'tapped',
  'dismissed',
  'toggled',
  'failed',
  'created',
  'updated',
  'deleted',
  'viewed',
  'requested',
  'completed',
  'opened',
  'submitted',
  'changed',
  'verified',
  'resent',
  'opted_in',
  'opted_out',
];
const EVENT_NAME = new RegExp(`^[a-z][a-z0-9]*(?:_[a-z0-9]+)*_(?:${EVENT_VERBS.join('|')})$`, 'u');
const SNAKE_CASE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;

function getParamMembers(type) {
  if (type?.type === 'TSTypeLiteral') {
    return type.members;
  }
  if (type?.type === 'TSIntersectionType') {
    return type.types.flatMap(getParamMembers);
  }
  return [];
}

/**
 * 맨 string이 들어오는 타입. 같은 파일의 별칭(`type X = string`)과 `${string}`이 든 템플릿 리터럴 타입도 따라간다.
 * 다른 파일에서 가져온 별칭은 따라가지 않는다
 */
function isBareString(type, aliases, seen = new Set()) {
  switch (type?.type) {
    case 'TSStringKeyword':
      return true;
    case 'TSUnionType':
      return type.types.some((member) => isBareString(member, aliases, seen));
    case 'TSTemplateLiteralType':
      return type.types.some((member) => isBareString(member, aliases, seen));
    case 'TSTypeReference': {
      const name = type.typeName.type === 'Identifier' ? type.typeName.name : null;
      if (name == null || !aliases.has(name) || seen.has(name)) {
        return false;
      }
      seen.add(name);
      return isBareString(aliases.get(name), aliases, seen);
    }
    default:
      return false;
  }
}

function collectTypeAliases(program) {
  const aliases = new Map();
  for (const declaration of topLevelDeclarations(program)) {
    if (declaration.type === 'TSTypeAliasDeclaration') {
      aliases.set(declaration.id.name, declaration.typeAnnotation);
    }
  }
  return aliases;
}

// 이벤트 카탈로그(AppEventMap)의 이름은 {entity}_{object?}_{verb}, 파라미터는 snake_case이고 맨 string을 쓰지 않는다.
// GA 대시보드가 보는 기존 이름은 frozenNames로 동결한다(바꿀 때는 별칭 기간을 둔다)
const analyticsEventCatalog = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { frozenNames: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const frozenNames = new Set(context.options[0]?.frozenNames ?? []);
    let aliases = new Map();

    function checkParams(eventName, type) {
      for (const member of getParamMembers(type)) {
        const name = getKeyName(member);
        if (name == null) {
          continue;
        }
        if (!SNAKE_CASE.test(name)) {
          context.report({
            node: member.key,
            message: `${eventName}.${name}: 이벤트 파라미터는 snake_case로 씁니다.`,
          });
        }
        if (isBareString(member.typeAnnotation?.typeAnnotation, aliases)) {
          context.report({
            node: member,
            message: `${eventName}.${name}: 맨 string 대신 값 목록 유니온이나 도메인 타입을 씁니다. 자유 문자열은 개인정보와 높은 카디널리티를 싣습니다.`,
          });
        }
      }
    }

    return {
      Program(program) {
        aliases = collectTypeAliases(program);
      },
      TSInterfaceDeclaration(node) {
        if (node.id.name !== 'AppEventMap') {
          return;
        }
        for (const member of node.body.body) {
          const eventName = member.type === 'TSPropertySignature' ? getKeyName(member) : null;
          if (eventName == null) {
            continue;
          }
          if (!frozenNames.has(eventName) && !EVENT_NAME.test(eventName)) {
            context.report({
              node: member.key,
              message: `${eventName}: 새 이벤트 이름은 {entity}_{object?}_{verb}이고 동사는 ${EVENT_VERBS.join('·')}만 씁니다.`,
            });
          }
          checkParams(eventName, member.typeAnnotation?.typeAnnotation);
        }
      },
    };
  },
};

const LOG_EVENT_KEY =
  /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const LOG_EVENT_FILE = /log-events\.ts$/u;
const QUOTED_VALUE = /:\s*['"]([^'"]+)['"]/gu;
const fileKeysCache = new Map();

function findPackageRoot(filename) {
  let directory = dirname(filename);
  while (directory !== dirname(directory)) {
    if (existsSync(join(directory, 'package.json'))) {
      return directory;
    }
    directory = dirname(directory);
  }
  return null;
}

function readFileKeys(path) {
  const modifiedAt = statSync(path).mtimeMs;
  const cached = fileKeysCache.get(path);
  if (cached?.modifiedAt === modifiedAt) {
    return cached.keys;
  }
  const keys = [...readFileSync(path, 'utf8').matchAll(QUOTED_VALUE)].map(([, key]) => key);
  fileKeysCache.set(path, { modifiedAt, keys });
  return keys;
}

/** 같은 패키지 src/의 다른 로그 키 파일이 쓰는 키 → 그 파일(패키지 기준 경로) */
function collectOtherFileKeys(filename) {
  const root = findPackageRoot(filename);
  const sourceRoot = root == null ? null : join(root, 'src');
  if (sourceRoot == null || !existsSync(sourceRoot)) {
    return new Map();
  }
  const current = resolve(filename);
  const owners = new Map();
  for (const relativePath of readdirSync(sourceRoot, { recursive: true, encoding: 'utf8' })) {
    const path = join(sourceRoot, relativePath);
    if (!LOG_EVENT_FILE.test(relativePath) || path === current) {
      continue;
    }
    for (const key of readFileKeys(path)) {
      owners.set(key, `src/${relativePath}`);
    }
  }
  return owners;
}

// 로그·breadcrumb 키는 {feature}.{subject}.{outcome} 세 마디 kebab-case이고 앱 전체에서 하나의 뜻만 갖는다.
// 다른 파일과 겹치는지는 같은 패키지 src/의 *log-events.ts를 읽어 본다
const LOG_EVENT_CONSTANT = /_LOG_EVENT$/u;

function collectExportedConstNames(program) {
  return program.body.flatMap((statement) =>
    statement.type === 'ExportNamedDeclaration' &&
    statement.declaration?.type === 'VariableDeclaration' &&
    statement.declaration.kind === 'const'
      ? statement.declaration.declarations
          .filter((declarator) => declarator.id.type === 'Identifier')
          .map((declarator) => declarator.id.name)
      : [],
  );
}

const SEGMENT = '[a-z0-9]+(?:-[a-z0-9]+)*';
const CONTEXT_FROM_PATH = /\/modules\/([^/]+)\//u;

function unwrapExpression(node) {
  let current = node;
  while (current?.type === 'TSAsExpression' || current?.type === 'TSSatisfiesExpression') {
    current = current.expression;
  }
  return current;
}

function buildKeyPattern({ minSegments, maxSegments, singleWordOutcome }) {
  const outcome = singleWordOutcome ? '[a-z0-9]+' : SEGMENT;
  return new RegExp(
    `^${SEGMENT}(?:\\.${SEGMENT}){${minSegments - 2},${maxSegments - 2}}\\.${outcome}$`,
    'u',
  );
}

const logEventKey = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: {
          constantPattern: { type: 'string' },
          minSegments: { type: 'integer', minimum: 2 },
          maxSegments: { type: 'integer', minimum: 2 },
          singleWordOutcome: { type: 'boolean' },
          contextFromPath: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] ?? {};
    const constantPattern =
      options.constantPattern == null
        ? LOG_EVENT_CONSTANT
        : new RegExp(options.constantPattern, 'u');
    const keyShape = {
      minSegments: options.minSegments ?? 3,
      maxSegments: options.maxSegments ?? 3,
      singleWordOutcome: options.singleWordOutcome ?? false,
    };
    const keyPattern =
      options.minSegments == null && options.maxSegments == null && !keyShape.singleWordOutcome
        ? LOG_EVENT_KEY
        : buildKeyPattern(keyShape);
    const shapeLabel =
      keyPattern === LOG_EVENT_KEY
        ? '{feature}.{subject}.{outcome} 세 마디 kebab-case'
        : `{context}.{subject}[.{detail}].{outcome} ${keyShape.minSegments}~${keyShape.maxSegments}마디, 마지막은 하이픈 없는 결과 한 단어`;
    const expectedContext = options.contextFromPath
      ? (CONTEXT_FROM_PATH.exec(context.filename)?.[1] ?? null)
      : null;
    const seen = new Set();
    let otherFileKeys = null;

    function checkKey(value) {
      const key = value.value;
      if (!keyPattern.test(key)) {
        context.report({ node: value, message: `${key}: 로그 키는 ${shapeLabel}입니다.` });
      }
      if (expectedContext != null && !key.startsWith(`${expectedContext}.`)) {
        context.report({
          node: value,
          message: `${key}: 첫 마디는 이 파일의 Context(${expectedContext})입니다.`,
        });
      }
      if (seen.has(key)) {
        context.report({ node: value, message: `${key}: 같은 파일에 이미 있는 로그 키입니다.` });
      }
      seen.add(key);
      otherFileKeys ??= collectOtherFileKeys(context.filename);
      const owner = otherFileKeys.get(key);
      if (owner != null) {
        context.report({
          node: value,
          message: `${key}: ${owner}에도 있는 로그 키입니다. 키는 앱 전체에서 하나의 뜻만 갖습니다(Sentry 대시보드).`,
        });
      }
    }

    return {
      Program(program) {
        const exported = collectExportedConstNames(program);
        if (exported.length !== 1 || !constantPattern.test(exported[0])) {
          context.report({
            node: program,
            message: `로그 키 파일은 ${constantPattern.source} 상수 하나만 내보냅니다(지금: ${exported.join(', ') || '없음'}).`,
          });
        }
        for (const statement of program.body) {
          const declaration =
            statement.type === 'ExportNamedDeclaration' ? statement.declaration : null;
          if (declaration?.type !== 'VariableDeclaration') {
            continue;
          }
          for (const declarator of declaration.declarations) {
            const initializer = unwrapExpression(declarator.init);
            if (
              declarator.id.type !== 'Identifier' ||
              !constantPattern.test(declarator.id.name) ||
              initializer?.type !== 'ObjectExpression'
            ) {
              continue;
            }
            for (const property of initializer.properties) {
              const value = property.type === 'Property' ? property.value : null;
              if (value?.type === 'Literal' && typeof value.value === 'string') {
                checkKey(value);
              }
            }
          }
        }
      },
    };
  },
};

const LOGGER_METHODS = new Set(['debug', 'info', 'warn', 'error']);

function getTerminalName(node) {
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (node.type === 'MemberExpression' && !node.computed) {
    return node.property.name ?? null;
  }
  return null;
}

// logger 호출은 로그 키 상수로 키를 넘긴다. 문자열을 바로 쓰면 log-event-key의 형식·유일성 검사를 건너뛴다.
// 앱은 첫 인자가 키, 서버는 첫 인자 객체의 eventProperty(event)가 키다
const loggerEventConstant = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: {
          eventProperty: { type: 'string' },
          methods: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] ?? {};
    const methods = new Set(options.methods ?? LOGGER_METHODS);
    const eventProperty = options.eventProperty ?? null;
    function isLiteralKey(node) {
      return (
        (node?.type === 'Literal' && typeof node.value === 'string') ||
        node?.type === 'TemplateLiteral'
      );
    }
    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== 'MemberExpression' ||
          callee.computed ||
          !methods.has(callee.property.name) ||
          getTerminalName(callee.object) !== 'logger'
        ) {
          return;
        }
        const [first] = node.arguments;
        const key =
          eventProperty != null && first?.type === 'ObjectExpression'
            ? first.properties.find(
                (property) =>
                  property.type === 'Property' &&
                  !property.computed &&
                  property.key.type === 'Identifier' &&
                  property.key.name === eventProperty,
              )?.value
            : first;
        if (isLiteralKey(key)) {
          context.report({
            node: key,
            message:
              'logger에는 문자열 대신 log-events 파일의 로그 키 상수를 넘깁니다(observability.md).',
          });
        }
      },
    };
  },
};

const EFFECT_HOOKS = new Set([
  'useEffect',
  'useLayoutEffect',
  'useInsertionEffect',
  'useFocusEffect',
]);
const CALLBACK_HOOKS = new Set(['useCallback']);
const TRACKING_FUNCTIONS = new Set(['track', 'trackEvent', 'trackScreenView']);
const TRACKING_METHODS = new Set(['trackEvent', 'trackScreenView']);
const FUNCTION_TYPES = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
]);

function isTrackingCall(callee) {
  const target = unwrap(callee);
  if (target?.type === 'Identifier') {
    return TRACKING_FUNCTIONS.has(target.name);
  }
  return (
    target?.type === 'MemberExpression' &&
    !target.computed &&
    TRACKING_METHODS.has(target.property.name)
  );
}

function findEnclosingFunction(node) {
  for (let current = node.parent; current != null; current = current.parent) {
    if (FUNCTION_TYPES.has(current.type)) {
      return current;
    }
  }
  return null;
}

function isFirstArgumentOf(node, hookNames) {
  const { parent } = node;
  return (
    parent?.type === 'CallExpression' &&
    parent.arguments[0] === node &&
    hookNames.has(getCalleeName(parent.callee))
  );
}

/** `useEffect(() => …)`·`useFocusEffect(useCallback(() => …))`의 본문 함수 */
function isEffectBody(functionNode) {
  if (isFirstArgumentOf(functionNode, EFFECT_HOOKS)) {
    return true;
  }
  const { parent } = functionNode;
  return isFirstArgumentOf(functionNode, CALLBACK_HOOKS) && isFirstArgumentOf(parent, EFFECT_HOOKS);
}

// 보기 하나에 장치 하나다. 경로 보기는 전역 screen_view, 경로가 아닌 보기는 useTrackView가 key마다 한 번 보낸다.
// 효과 본문에서 바로 보내면 deps가 바뀌거나 다시 마운트될 때 같은 보기를 다시 센다. 구독 콜백·.then 같은 중첩 함수는 사건이라 보지 않는다
const noTrackingInEffect = {
  meta: { type: 'problem' },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isTrackingCall(node.callee)) {
          return;
        }
        const functionNode = findEnclosingFunction(node);
        if (functionNode == null || !isEffectBody(functionNode)) {
          return;
        }
        context.report({
          node,
          message:
            '효과 본문에서 추적하지 않습니다. 경로 보기는 전역 screen_view, 시트·카드·받은 내용 노출은 useTrackView, 누름·결과는 핸들러·mutation에서 보냅니다(observability.md).',
        });
      },
    };
  },
};

export default {
  'analytics-event-catalog': analyticsEventCatalog,
  'log-event-key': logEventKey,
  'logger-event-constant': loggerEventConstant,
  'no-tracking-in-effect': noTrackingInEffect,
};
