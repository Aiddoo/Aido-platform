import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { TAB_ICON_IMAGES } from './tab-icon-images.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await mkdir(resolve(root, 'assets/tab-icons'), { recursive: true });

for (const { sourcePath, outputPath, size, density } of TAB_ICON_IMAGES) {
  const source = await readFile(resolve(root, sourcePath));
  const png = await sharp(source, { density }).resize(size, size).png().toBuffer();
  await writeFile(resolve(root, outputPath), png);
}
console.log(`공용 탭 SVG에서 네이티브 아이콘 ${TAB_ICON_IMAGES.length}개를 생성했습니다.`);
