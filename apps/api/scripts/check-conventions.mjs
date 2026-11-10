// 서버 관례 검사. 새 slice·옮긴 Context(architecture.ratchet.json)만 실패시키고 옛 경로는 경고로 둔다.
//   node scripts/check-conventions.mjs [--file <path>] [--strict-enums]
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(apiRoot, "../..");
const SOURCE_ROOTS = ["apps/api/src", "packages/api/src"];
const JUNK_FILE = /(?:^|\/)(?:\.DS_Store|\.gitkeep)$/;
const LEGACY_LAYERS = new Set(["domain", "application", "infrastructure", "presentation"]);
const MEMBER_KEYWORD = /^\s+(private|public|protected)\s/;
const FORWARD_REF = /\bforwardRef\(/;
const PG_ENUM_LITERAL = /pgEnum\(\s*["'`][^"'`]+["'`]\s*,\s*\[/g;
// shared/domain 기반 클래스의 하위 클래스 확장점만 protected를 쓴다.
const PROTECTED_ALLOWED = /^src\/shared\/domain\//;

const args = process.argv.slice(2);
const strictEnums = args.includes("--strict-enums");
const fileFlagIndex = args.indexOf("--file");
const singleFile = fileFlagIndex === -1 ? null : args[fileFlagIndex + 1];

const { migratedContexts } = JSON.parse(
  readFileSync(join(apiRoot, "architecture.ratchet.json"), "utf8"),
);

function toApiRelative(filePath) {
  const absolute = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
  return relative(apiRoot, absolute).split(sep).join("/");
}

function isStrictPath(rel) {
  const segments = rel.split("/");
  if (segments[0] !== "src" || segments[1] !== "modules" || segments.length < 4) {
    return false;
  }
  if (migratedContexts.includes(segments[2])) {
    return true;
  }
  return segments.length >= 5 && !LEGACY_LAYERS.has(segments[3]);
}

function isEnumSchemaPath(rel) {
  return /^src\/platform\/database\/schema\/[^/]+\.ts$/.test(rel);
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function checkFile(rel, violations, warnings) {
  const text = readFileSync(join(apiRoot, rel), "utf8");
  const strict = isStrictPath(rel);
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    if (strict) {
      const match = MEMBER_KEYWORD.exec(line);
      if (match && !(match[1] === "protected" && PROTECTED_ALLOWED.test(rel))) {
        violations.push(
          `${rel}:${index + 1}: '${match[1]}' 멤버 키워드는 쓰지 않는다. 비공개는 '#' 필드·메서드로 둔다.`,
        );
      }
    }
    if (FORWARD_REF.test(line)) {
      const entry = `${rel}:${index + 1}: forwardRef 순환 의존. 좁은 Port를 public으로 열고 반대 방향은 이벤트로 바꾼다.`;
      (strict ? violations : warnings).push(entry);
    }
  });

  if (isEnumSchemaPath(rel)) {
    const enumLines = [...text.matchAll(PG_ENUM_LITERAL)].map((match) => lineOf(text, match.index));
    const reason = "pgEnum 값을 리터럴 배열로 적었다. @aido/api/vocabulary 상수 튜플에서 유도한다.";
    if (strictEnums) {
      violations.push(...enumLines.map((line) => `${rel}:${line}: ${reason}`));
    } else if (enumLines.length > 0) {
      warnings.push(`${rel}: ${reason} (${enumLines.length}건: 줄 ${enumLines.join(", ")})`);
    }
  }
}

function listSourceFiles() {
  return readdirSync(join(apiRoot, "src"), { recursive: true })
    .map((entry) => `src/${String(entry).split(sep).join("/")}`)
    .filter((rel) => rel.endsWith(".ts"));
}

// 비어 있는 폴더(하위까지 포함해 파일이 없거나 .DS_Store·.gitkeep뿐)는 남기지 않는다.
function findEmptyDirectories(dirPath, violations) {
  let hasContent = false;
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      hasContent = findEmptyDirectories(join(dirPath, entry.name), violations) || hasContent;
    } else if (entry.name !== ".DS_Store" && entry.name !== ".gitkeep") {
      hasContent = true;
    }
  }
  if (!hasContent) {
    violations.push(
      `${relative(repoRoot, dirPath).split(sep).join("/")}: 파일 없는 빈 폴더. 폴더를 지운다.`,
    );
  }
  return hasContent;
}

function findTrackedJunkFiles(violations) {
  let tracked;
  try {
    tracked = execFileSync("git", ["ls-files", "-z"], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return;
  }
  for (const path of tracked.split("\0")) {
    if (JUNK_FILE.test(path)) {
      violations.push(`${path}: 추적하면 안 되는 파일(.DS_Store·.gitkeep). 지운다.`);
    }
  }
}

const violations = [];
const warnings = [];
const files = singleFile == null ? listSourceFiles() : [toApiRelative(singleFile)];

for (const rel of files) {
  if (!rel.startsWith("src/") || !rel.endsWith(".ts")) {
    continue;
  }
  checkFile(rel, violations, warnings);
}

if (singleFile == null) {
  for (const sourceRoot of SOURCE_ROOTS) {
    findEmptyDirectories(join(repoRoot, sourceRoot), violations);
  }
  findTrackedJunkFiles(violations);
}

if (singleFile == null && warnings.length > 0) {
  console.log(`경고 ${warnings.length}건(옛 경로이거나 --strict-enums 전에는 실패하지 않는 검사):`);
  for (const warning of warnings) {
    console.log(`  ${warning}`);
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }
  process.exit(1);
}
