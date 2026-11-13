// 문서 검사: 깨진 상대 링크·앵커, 없는 저장소 경로, 길이 한도, 에이전트 파일 모양, shared/ui 부품 문서.
// 규칙과 허용 목록은 docs/conventions/docs.md와 docs-check.config.json에 있다.
// 사용: node scripts/docs/docs-check.mjs [--idents]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// 생성·외부 문서(changesets, heroui 스킬, 스토어 메타데이터)는 이 저장소가 쓰지 않는다.
const EXCLUDED = [
  /(^|\/)CHANGELOG\.md$/,
  /^\.changeset\//,
  /^apps\/mobile\/\.agents\//,
  /^apps\/mobile\/store-metadata\//,
  /(^|\/)node_modules\//,
];
// 출시 기록은 그때 상태로 얼려 둔다. 링크한 파일이 있는지만 본다.
const FROZEN = [/^docs\/releases\//, /^apps\/mobile\/docs\/releases\//];

const PATH_PREFIXES = [
  'apps/',
  'packages/',
  'tooling/',
  'docs/',
  'scripts/',
  '.github/',
  '.claude/',
  '.maestro/',
  'src/',
  'app/',
  'features/',
  'shared/',
  'bootstrap/',
  'core/',
  'test/',
  'drizzle/',
  'plugins/',
];
const PLACEHOLDER = /[{}<>*|$…\s]|\.\.\.|x-y-z|xxx/i;
const CODE_EXTENSIONS = ['', '.ts', '.tsx', '.js'];
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function countLines(text) {
  if (text === '') {
    return 0;
  }
  const breaks = text.split('\n').length - 1;
  return text.endsWith('\n') ? breaks : breaks + 1;
}

// 펜스 안의 줄은 빈 줄로 바꿔 줄 번호를 유지한다.
export function stripFences(text) {
  let fence = null;
  return text.split('\n').map((line) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line);
    if (marker != null) {
      if (fence == null) {
        fence = marker[1][0];
        return '';
      }
      if (marker[1][0] === fence) {
        fence = null;
        return '';
      }
    }
    return fence == null ? line : '';
  });
}

// GitHub(github-slugger)와 같은 규칙: 소문자, 글자·숫자·밑줄·하이픈·공백만 남기고 공백은 하이픈.
export function slugify(heading) {
  return heading
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

export function anchorsOf(text) {
  const anchors = new Set();
  const seen = new Map();
  const lines = stripFences(text);
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading != null) {
      const base = slugify(heading[2]);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      anchors.add(count === 0 ? base : `${base}-${count}`);
    }
    for (const match of line.matchAll(/<a\s+(?:name|id)="([^"]+)"/g)) {
      anchors.add(match[1]);
    }
  }
  return anchors;
}

function withoutCodeSpans(line) {
  return line.replace(/`[^`\n]*`/g, (span) => ' '.repeat(span.length));
}

// `](` 뒤의 대상을 괄호 짝을 맞춰 읽는다. route 경로 `app/(app)/x.tsx`가 링크에 들어간다.
export function extractLinks(line) {
  const text = withoutCodeSpans(line);
  const targets = [];
  const reference = /^\s*\[[^\]]+\]:\s*<?([^\s>]+)>?/.exec(text);
  if (reference != null) {
    targets.push(reference[1]);
  }
  let from = 0;
  for (;;) {
    const start = text.indexOf('](', from);
    if (start === -1) {
      break;
    }
    let index = start + 2;
    let depth = 0;
    let target = '';
    const angled = text[index] === '<';
    if (angled) {
      const end = text.indexOf('>', index);
      target = end === -1 ? '' : text.slice(index + 1, end);
      index = end === -1 ? text.length : end + 1;
    } else {
      while (index < text.length) {
        const char = text[index];
        if (char === '(') {
          depth += 1;
        } else if (char === ')') {
          if (depth === 0) {
            break;
          }
          depth -= 1;
        } else if (char === ' ') {
          break;
        }
        target += char;
        index += 1;
      }
    }
    if (target !== '') {
      targets.push(target);
    }
    from = index;
  }
  return targets;
}

export function extractCodeSpans(line) {
  return [...line.matchAll(/`([^`\n]+)`/g)].map((match) => match[1].trim());
}

export function isPathCandidate(code) {
  if (PLACEHOLDER.test(code) || URL_SCHEME.test(code) || code.startsWith('@')) {
    return false;
  }
  const path = code.replace(/^\.\//, '');
  if (!path.includes('/')) {
    return /^[\w.-]+\.md$/.test(path) && !path.startsWith('.') && !path.startsWith('-');
  }
  return PATH_PREFIXES.some((prefix) => path.startsWith(prefix)) || path.startsWith('../');
}

const APP_ROOTS = ['apps/mobile', 'apps/api', 'packages/api'];

function ownerRoots(doc) {
  const owner = /^(apps\/[^/]+|packages\/[^/]+|tooling\/[^/]+)\//.exec(doc);
  return owner == null ? APP_ROOTS : [owner[1], ...APP_ROOTS.filter((root) => root !== owner[1])];
}

function normalizeCode(code) {
  return code.replace(/^\.\//, '').replace(/(:\d+(-\d+)?|#L\d+(-L\d+)?)$/, '');
}

function isBareName(code) {
  return !normalizeCode(code).includes('/');
}

export function pathCandidates(doc, code) {
  const path = normalizeCode(code).replace(/\/$/, '');
  const docDir = posix.dirname(doc);
  if (path.startsWith('../')) {
    return [posix.normalize(posix.join(docDir, path))];
  }
  if (isBareName(code)) {
    return [path];
  }
  return [
    path,
    posix.normalize(posix.join(docDir, path)),
    ...ownerRoots(doc).flatMap((root) => [`${root}/${path}`, `${root}/src/${path}`]),
  ];
}

export function createTree(files) {
  const fileSet = new Set(files);
  const dirSet = new Set();
  const basenames = new Set();
  const suffixes = new Set();
  for (const file of files) {
    const parts = file.split('/');
    for (let index = 1; index < parts.length - 1; index += 1) {
      suffixes.add(parts.slice(index).join('/'));
    }
    basenames.add(posix.basename(file));
    let dir = posix.dirname(file);
    while (dir !== '.' && !dirSet.has(dir)) {
      dirSet.add(dir);
      const parts = dir.split('/');
      for (let index = 1; index < parts.length - 1; index += 1) {
        suffixes.add(parts.slice(index).join('/'));
      }
      dir = posix.dirname(dir);
    }
  }
  return {
    hasFile: (path) => fileSet.has(path),
    has: (path) => fileSet.has(path) || dirSet.has(path),
    hasBasename: (name) => basenames.has(name),
    hasSuffix: (path) => suffixes.has(path),
    dirs: () => dirSet,
  };
}

// 문서는 앞 문장의 기능 폴더를 생략하고 `shared/domain/x.ts`처럼 쓰기도 해서 마지막에 경로 끝 일치를 본다.
export function pathExists(tree, doc, code) {
  const candidates = pathCandidates(doc, code);
  if (isBareName(code)) {
    return tree.hasBasename(candidates[0]);
  }
  return candidates.some((candidate) =>
    CODE_EXTENSIONS.some(
      (extension) =>
        tree.has(`${candidate}${extension}`) ||
        (!code.startsWith('../') && tree.hasSuffix(`${candidate}${extension}`)),
    ),
  );
}

function resolveLink(doc, target) {
  const [rawPath, rawAnchor] = target.split('#');
  const path = decodeURIComponent(rawPath);
  const anchor = rawAnchor == null ? null : decodeURIComponent(rawAnchor);
  if (path === '') {
    return { path: doc, anchor };
  }
  const joined = path.startsWith('/') ? path.slice(1) : posix.join(posix.dirname(doc), path);
  return { path: posix.normalize(joined).replace(/\/$/, ''), anchor };
}

function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (match == null) {
    return null;
  }
  const fields = new Map();
  for (const line of match[1].split('\n')) {
    const field = /^([\w-]+):\s*(.*)$/.exec(line);
    if (field != null) {
      fields.set(field[1], field[2].trim());
    }
  }
  return fields;
}

function checkAgentFile(doc, text, config, report) {
  const base = posix.basename(doc);
  if (base === 'CLAUDE.md' && text.trim() !== '@AGENTS.md') {
    report(doc, 1, 'agent-files', 'CLAUDE.md는 `@AGENTS.md` 한 줄이다');
  }
  if (/(^|\/)\.claude\/rules\/[^/]+\.md$/.test(doc)) {
    const fields = parseFrontmatter(text);
    if (fields == null || !fields.has('paths')) {
      report(doc, 1, 'agent-files', 'rules 파일은 frontmatter에 `paths:`가 있어야 한다');
    }
    if (countLines(text) > config.ruleLineLimit) {
      report(doc, 1, 'agent-files', `rules 파일은 ${config.ruleLineLimit}줄 이하다`);
    }
  }
  if (base === 'SKILL.md') {
    const skill = /(^|\/)\.(?:agents|claude)\/skills\/([^/]+)\/SKILL\.md$/.exec(doc);
    if (skill == null) {
      report(doc, 1, 'agent-files', 'SKILL.md는 `.agents/skills/<이름>/SKILL.md`에 둔다');
      return;
    }
    const fields = parseFrontmatter(text);
    if (fields == null || fields.get('name') !== skill[2]) {
      report(doc, 1, 'agent-files', `스킬 frontmatter \`name\`은 폴더 이름(${skill[2]})이다`);
    }
    if (fields == null || (fields.get('description') ?? '') === '') {
      report(doc, 1, 'agent-files', '스킬 frontmatter에 `description`이 있어야 한다');
    }
  }
}

// Codex는 `.agents/skills`, Claude Code는 `.claude/skills`만 읽어 정본 옆에 Claude용 링크가 있어야 한다.
function checkSkillLinks(docs, tree, report) {
  for (const doc of docs) {
    const skill = /^(.*\/)?\.agents\/skills\/([^/]+)\/SKILL\.md$/.exec(doc);
    if (skill == null) {
      continue;
    }
    const link = `${skill[1] ?? ''}.claude/skills/${skill[2]}`;
    if (!tree.has(link)) {
      report(doc, 1, 'agent-files', `Claude가 읽도록 \`${link}\` 링크를 둔다`);
    }
  }
}

function checkAgentsSize(docs, read, config, report) {
  const rootSize = Buffer.byteLength(read('AGENTS.md') ?? '');
  for (const doc of docs) {
    if (doc === 'AGENTS.md' || posix.basename(doc) !== 'AGENTS.md') {
      continue;
    }
    const size = rootSize + Buffer.byteLength(read(doc) ?? '');
    if (size > config.agentsBytesLimit) {
      report(
        doc,
        1,
        'agent-files',
        `루트+이 AGENTS.md가 ${size}B다(한도 ${config.agentsBytesLimit}B)`,
      );
    }
  }
}

function checkUiDocs(tree, report) {
  const uiRoot = 'apps/mobile/src/shared/ui';
  for (const dir of tree.dirs()) {
    if (posix.dirname(dir) !== uiRoot) {
      continue;
    }
    const name = posix.basename(dir);
    if (!tree.hasFile(`${dir}/${name}.md`)) {
      report(`${dir}/${name}.md`, 1, 'ui-doc', 'shared/ui 부품마다 같은 이름의 .md를 둔다');
    }
  }
}

function lineLimitOf(doc, config) {
  return config.lineLimits?.[doc] ?? config.lineLimit;
}

/**
 * files: 저장소 기준 경로 목록, read(path): 내용 또는 null, isIgnored(paths): git-ignored 여부.
 */
export function checkDocs({ files, read, isIgnored = () => false, config }) {
  const tree = createTree(files);
  const docs = files.filter((file) => file.endsWith('.md') && !EXCLUDED.some((r) => r.test(file)));
  const failures = [];
  const allowUsed = new Set();
  const allowed = (doc, check, match) => {
    const index = config.allow.findIndex(
      (entry) =>
        entry.path === doc &&
        entry.check === check &&
        (entry.match == null || entry.match === match),
    );
    if (index !== -1) {
      allowUsed.add(index);
    }
    return index !== -1;
  };
  const report = (doc, line, check, message, match) => {
    if (!allowed(doc, check, match)) {
      failures.push({ doc, line, check, message });
    }
  };
  const anchorCache = new Map();
  const anchorsFor = (path) => {
    if (!anchorCache.has(path)) {
      anchorCache.set(path, anchorsOf(read(path) ?? ''));
    }
    return anchorCache.get(path);
  };

  for (const doc of docs) {
    const text = read(doc);
    if (text == null) {
      continue;
    }
    const frozen = FROZEN.some((r) => r.test(doc));
    const lines = stripFences(text);
    lines.forEach((line, index) => {
      for (const target of extractLinks(line)) {
        if (URL_SCHEME.test(target) || target.startsWith('//')) {
          continue;
        }
        const link = resolveLink(doc, target);
        if (link.path !== doc && !tree.has(link.path)) {
          report(doc, index + 1, 'link', `없는 파일: ${target}`, target);
          continue;
        }
        if (frozen || link.anchor == null || link.anchor === '' || !link.path.endsWith('.md')) {
          continue;
        }
        if (!anchorsFor(link.path).has(link.anchor)) {
          report(doc, index + 1, 'anchor', `없는 제목: ${target}`, target);
        }
      }
      if (frozen) {
        return;
      }
      for (const code of extractCodeSpans(line)) {
        if (!isPathCandidate(code) || pathExists(tree, doc, code)) {
          continue;
        }
        if (isIgnored(pathCandidates(doc, code))) {
          continue;
        }
        report(doc, index + 1, 'path', `없는 경로: \`${code}\``, code);
      }
    });
    if (!frozen) {
      const limit = lineLimitOf(doc, config);
      const count = countLines(text);
      if (count > limit) {
        report(doc, count, 'limit', `${count}줄이다(한도 ${limit}줄)`);
      }
    }
    checkAgentFile(doc, text, config, report);
  }
  checkAgentsSize(docs, read, config, report);
  checkSkillLinks(docs, tree, report);
  checkUiDocs(tree, report);

  config.allow.forEach((entry, index) => {
    if ((entry.reason ?? '').trim() === '') {
      failures.push({
        doc: entry.path,
        line: 1,
        check: 'allow',
        message: '허용 항목에 reason이 없다',
      });
    }
    if (!allowUsed.has(index)) {
      const what = entry.match == null ? entry.check : `${entry.check} ${entry.match}`;
      failures.push({
        doc: entry.path,
        line: 1,
        check: 'allow-stale',
        message: `더 걸리지 않는 허용 항목(${what})을 지운다`,
      });
    }
  });
  return { docs: docs.length, failures };
}

const IDENT_SHAPE =
  /^(use[A-Z]\w+|[A-Z]\w*(Policy|Api|Service|Repository|Store|StoredValue|Schema|UseCase|Port|Gateway)|[a-z]\w*(Schema|StoredValue)|[A-Z][A-Z0-9]*(_[A-Z0-9]+){2,})$/;
const PLACEHOLDER_IDENT = /X[A-Z]|X$|^x[A-Z]/;
const CODE_FILE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|json)$/;

// 정밀도가 낮아(의도한 반례·외부 API·지운 이름 기록) 게이트에 넣지 않고 사람이 읽는 보고만 낸다.
export function findMissingIdents({ files, read }) {
  const tokens = new Set();
  for (const file of files) {
    if (CODE_FILE.test(file) && !file.includes('node_modules/')) {
      for (const token of (read(file) ?? '').match(/[A-Za-z_$][\w$]*/g) ?? []) {
        tokens.add(token);
      }
    }
  }
  const missing = new Map();
  const docs = files.filter(
    (file) =>
      file.endsWith('.md') &&
      !EXCLUDED.some((r) => r.test(file)) &&
      !FROZEN.some((r) => r.test(file)),
  );
  for (const doc of docs) {
    stripFences(read(doc) ?? '').forEach((line, index) => {
      for (const code of extractCodeSpans(line)) {
        const name = /^([A-Za-z_$][\w$]*)(\(\))?$/.exec(code)?.[1];
        if (name == null || !IDENT_SHAPE.test(name) || PLACEHOLDER_IDENT.test(name)) {
          continue;
        }
        if (tokens.has(name)) {
          continue;
        }
        missing.set(name, [...(missing.get(name) ?? []), `${doc}:${index + 1}`]);
      }
    });
  }
  return missing;
}

function trackedFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return [...new Set(output.split('\0').filter((file) => file !== ''))].filter((file) =>
    existsSync(resolve(repoRoot, file)),
  );
}

// 하나라도 무시 대상이면 exit 0, 없으면 1이다. `-q`는 경로 하나에만 쓸 수 있다.
function gitIgnored(paths) {
  try {
    execFileSync('git', ['check-ignore', '--no-index', ...paths], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function readRepoFile(path) {
  try {
    return readFileSync(resolve(repoRoot, path), 'utf8');
  } catch {
    return null;
  }
}

function main() {
  const config = JSON.parse(
    readFileSync(resolve(repoRoot, 'scripts/docs/docs-check.config.json'), 'utf8'),
  );
  const files = trackedFiles();
  if (process.argv.includes('--idents')) {
    const missing = findMissingIdents({ files, read: readRepoFile });
    for (const [name, places] of [...missing].sort()) {
      process.stdout.write(
        `${name}\t${places.slice(0, 3).join(', ')}${places.length > 3 ? ` (+${places.length - 3})` : ''}\n`,
      );
    }
    process.stdout.write(`idents: 코드에 없는 식별자 ${missing.size}개(보고만, 실패 아님)\n`);
    return;
  }
  const { docs, failures } = checkDocs({
    files,
    read: readRepoFile,
    isIgnored: gitIgnored,
    config,
  });
  for (const failure of failures) {
    process.stderr.write(`${failure.doc}:${failure.line} ${failure.check} ${failure.message}\n`);
  }
  process.stdout.write(`docs-check: 문서 ${docs}개, 실패 ${failures.length}개\n`);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
