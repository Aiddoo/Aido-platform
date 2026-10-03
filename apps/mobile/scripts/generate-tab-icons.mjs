import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'assets/tab-icons');
await mkdir(output, { recursive: true });

for (const name of ['todo', 'memo', 'mypage']) {
  const source = await readFile(resolve(root, `assets/icons/ic_tab_${name}.svg`));
  for (const scale of [1, 2, 3]) {
    const size = 24 * scale;
    const png = await sharp(source, { density: 72 * scale })
      .resize(size, size)
      .png()
      .toBuffer();
    const suffix = scale === 1 ? '' : `@${scale}x`;
    await writeFile(resolve(output, `${name}${suffix}.png`), png);
  }
}
console.log('공용 탭 SVG에서 네이티브 아이콘 9개를 생성했습니다.');
