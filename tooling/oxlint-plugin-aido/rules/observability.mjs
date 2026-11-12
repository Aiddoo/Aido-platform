import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { getKeyName } from '../ast.mjs';

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

function isBareString(type) {
  if (type?.type === 'TSStringKeyword') {
    return true;
  }
  return type?.type === 'TSUnionType' && type.types.some(isBareString);
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
        if (isBareString(member.typeAnnotation?.typeAnnotation)) {
          context.report({
            node: member,
            message: `${eventName}.${name}: 맨 string 대신 값 목록 유니온이나 도메인 타입을 씁니다. 자유 문자열은 개인정보와 높은 카디널리티를 싣습니다.`,
          });
        }
      }
    }

    return {
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

const logEventKey = {
  meta: { type: 'suggestion' },
  create(context) {
    const seen = new Set();
    let otherFileKeys = null;
    return {
      Program(program) {
        const exported = collectExportedConstNames(program);
        if (exported.length !== 1 || !LOG_EVENT_CONSTANT.test(exported[0])) {
          context.report({
            node: program,
            message: `로그 키 파일은 *_LOG_EVENT 상수 하나만 내보냅니다(지금: ${exported.join(', ') || '없음'}).`,
          });
        }
      },
      Property(node) {
        const { value } = node;
        if (value.type !== 'Literal' || typeof value.value !== 'string') {
          return;
        }
        const key = value.value;
        if (!LOG_EVENT_KEY.test(key)) {
          context.report({
            node: value,
            message: `${key}: 로그 키는 {feature}.{subject}.{outcome} 세 마디 kebab-case입니다.`,
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

// logger 호출은 *_LOG_EVENT 상수로 키를 넘긴다. 문자열을 바로 쓰면 log-event-key의 형식·유일성 검사를 건너뛴다
const loggerEventConstant = {
  meta: { type: 'suggestion' },
  createOnce(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== 'MemberExpression' ||
          callee.computed ||
          !LOGGER_METHODS.has(callee.property.name) ||
          getTerminalName(callee.object) !== 'logger'
        ) {
          return;
        }
        const [key] = node.arguments;
        if (
          (key?.type === 'Literal' && typeof key.value === 'string') ||
          key?.type === 'TemplateLiteral'
        ) {
          context.report({
            node: key,
            message:
              'logger에는 문자열 대신 {feature}-log-events.ts의 *_LOG_EVENT 상수로 키를 넘깁니다(observability.md).',
          });
        }
      },
    };
  },
};

export default {
  'analytics-event-catalog': analyticsEventCatalog,
  'log-event-key': logEventKey,
  'logger-event-constant': loggerEventConstant,
};
