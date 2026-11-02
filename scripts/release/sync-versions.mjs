// 릴리스 버전은 앱(apps/mobile/package.json) 하나다. `changeset version`이 변경 파일을 CHANGELOG로
// 소비한 뒤 서버·공유 계약의 package.json 버전과 CHANGELOG 맨 위 제목을 앱 버전으로 맞춘다.
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const SEMVER = /^\d+\.\d+\.\d+$/;

const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const { version } = await readJson('apps/mobile/package.json');
if (!SEMVER.test(version)) {
  throw new Error(`apps/mobile/package.json version must be MAJOR.MINOR.PATCH: ${version}`);
}

const packages = [
  { manifest: 'apps/api/package.json', changelog: 'apps/api/CHANGELOG.md' },
  { manifest: 'packages/api/package.json', changelog: 'packages/api/CHANGELOG.md' },
];

for (const { manifest, changelog } of packages) {
  const pkg = await readJson(manifest);
  const previous = pkg.version;
  pkg.version = version;
  await writeFile(new URL(manifest, root), `${JSON.stringify(pkg, null, 2)}\n`);

  const path = new URL(changelog, root);
  const text = await readFile(path, 'utf8').catch(() => null);
  if (text != null) {
    const [title, ...sections] = text.split(/\n(?=## )/);
    if (sections.length > 0) {
      sections[0] = sections[0]
        .replace(/^## \d+\.\d+\.\d+/, `## ${version}`)
        .replaceAll(/(@aido\/api)@\d+\.\d+\.\d+/g, `$1@${version}`);
    }
    await writeFile(path, [title, ...sections].join('\n'));
  }
  console.log(`${pkg.name}: ${previous} -> ${version}`);
}
