#!/usr/bin/env node
// 배너 글꼴(Jua, 나눔손글씨 펜)을 storyboard의 문구 글자만 남겨 woff2로 줄인다.
// 원본은 google/fonts 저장소의 고정 커밋에서 받아 sha256을 확인하고 캐시에 둔다(OFL, 라이선스는 이 폴더).
// 필요: uv(uvx). 문구를 바꾸면 `node store-metadata/art/fonts/subset.mjs`를 다시 실행한다.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCENES } from '../storyboard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(homedir(), '.cache/aido-store-art/fonts');
const FONTTOOLS = 'fonttools[woff]==4.60.1';

export const FONTS = [
  {
    output: 'jua-subset.woff2',
    url: 'https://github.com/google/fonts/raw/c6f97839901e4707d3792b1c50f3f92eb66b3d2f/ofl/jua/Jua-Regular.ttf',
    sha256: '769677aef240bfc3b9965f2b50748075bff885e6c6992fc591a3fb268279f898',
    role: 'headline',
  },
  {
    output: 'hand-subset.woff2',
    url: 'https://github.com/google/fonts/raw/16680f8688ffcd467d2eb2146a9ce0343404581d/ofl/nanumpenscript/NanumPenScript-Regular.ttf',
    sha256: '6f0d1ab29c7894010dc88831fb7a0a51edb79136e450344183de5b1a8b52bd43',
    role: 'tagline',
  },
];

const BASE = ` !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_\`abcdefghijklmnopqrstuvwxyz{|}~‘’“”·…`;

// 배너 문구에서 글꼴별 글자를 모은다. [강조] 표시와 줄바꿈은 뺀다.
export function subsetText(role) {
  const copies = Object.values(SCENES).flatMap((scene) =>
    ['ko', 'en'].map((locale) => scene[locale]?.[role] ?? ''),
  );
  const chars = new Set([...BASE, ...copies.join('').replace(/[[\]\n]/gu, '')]);
  return [...chars].sort().join('');
}

async function original({ url, sha256 }) {
  const path = join(CACHE, `${sha256}.ttf`);
  if (!existsSync(path)) {
    mkdirSync(CACHE, { recursive: true });
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${url} 내려받기 실패: ${response.status}`);
    }
    writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  }
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (actual !== sha256) {
    throw new Error(`${url} sha256 불일치: ${actual}`);
  }
  return path;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const font of FONTS) {
    const text = subsetText(font.role);
    const textFile = join(HERE, `${font.output.replace('.woff2', '')}.txt`);
    writeFileSync(textFile, `${text}\n`);
    const result = spawnSync(
      'uvx',
      [
        '--from',
        FONTTOOLS,
        'pyftsubset',
        await original(font),
        `--text-file=${textFile}`,
        '--flavor=woff2',
        '--layout-features=*',
        '--no-hinting',
        `--output-file=${join(HERE, font.output)}`,
      ],
      { stdio: 'inherit' },
    );
    if (result.status !== 0) {
      throw new Error(`${font.output} 서브셋 실패`);
    }
    console.log(`${font.output}: ${[...text].length}자`);
  }
}
