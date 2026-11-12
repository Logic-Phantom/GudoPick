// 의존성 라이선스 목록 생성 스크립트.
//
// package-lock.json에서 앱에 포함되는(dev가 아닌) 패키지를 모아
//  - src/shared/licenses.generated.json  (앱 내 '오픈소스 라이선스' 화면)
//  - docs/THIRD_PARTY_NOTICES.md         (전체 목록)
// 을 만든다. 패키지 버전을 바꾼 뒤에는 다시 실행하고 결과를 검토한다.
//
// 실행: node scripts/generate-licenses.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const direct = new Set(Object.keys(pkg.dependencies ?? {}));

/** 허용 목록: 재배포 시 고지 의무만 있는 허용적 라이선스 */
const PERMISSIVE = /^(MIT|ISC|0BSD|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|Unlicense|CC0-1\.0|BlueOak-1\.0\.0|Python-2\.0|CC-BY-4\.0|MIT-0|Zlib)$/;

function normalize(license) {
  if (!license) return 'UNKNOWN';
  if (typeof license === 'string') return license;
  if (Array.isArray(license)) return license.map(normalize).join(' OR ');
  return license.type ?? 'UNKNOWN';
}

function readLicense(path, lockEntry) {
  if (lockEntry.license) return normalize(lockEntry.license);
  const manifest = join(root, path, 'package.json');
  if (existsSync(manifest)) {
    try {
      const json = JSON.parse(readFileSync(manifest, 'utf8'));
      return normalize(json.license ?? json.licenses);
    } catch {
      return 'UNKNOWN';
    }
  }
  return 'UNKNOWN';
}

const seen = new Map();
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (!path.startsWith('node_modules/')) continue;
  if (entry.dev || entry.devOptional) continue;
  if (entry.link) continue; // 로컬 모듈(gudopick-vision)은 이 저장소의 코드다
  const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const key = `${name}@${entry.version}`;
  if (seen.has(key)) continue;
  seen.set(key, { name, version: entry.version, license: readLicense(path, entry), direct: direct.has(name) });
}

const all = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

function isPermissive(expression) {
  // "(MIT OR Apache-2.0)" 같은 표현은 하나라도 허용 라이선스면 그쪽을 선택할 수 있다.
  const parts = expression.replace(/[()]/g, '').split(/\s+(?:OR|AND)\s+/i);
  if (/\sAND\s/i.test(expression)) return parts.every((part) => PERMISSIVE.test(part.trim()));
  return parts.some((part) => PERMISSIVE.test(part.trim()));
}

const review = all.filter((item) => !isPermissive(item.license));
const counts = {};
for (const item of all) counts[item.license] = (counts[item.license] ?? 0) + 1;

const generated = {
  generatedAt: new Date().toISOString().slice(0, 10),
  total: all.length,
  counts,
  direct: all.filter((item) => item.direct).map(({ name, version, license }) => ({ name, version, license })),
  needsReview: review.map(({ name, version, license }) => ({ name, version, license })),
};
writeFileSync(join(root, 'src/shared/licenses.generated.json'), `${JSON.stringify(generated, null, 2)}\n`);

const lines = [
  '# THIRD_PARTY_NOTICES',
  '',
  `> 자동 생성 파일입니다 (\`node scripts/generate-licenses.mjs\`, ${generated.generatedAt}). 직접 수정하지 마세요.`,
  '> 앱에 포함되는(devDependencies 제외) npm 패키지 목록입니다. 네이티브 SDK(Google ML Kit, AndroidX CameraX 등)는 docs/LICENSES.md 에 따로 정리합니다.',
  '',
  `총 ${all.length}개 패키지`,
  '',
  '## 라이선스별 개수',
  '',
  '| 라이선스 | 개수 |',
  '|---|---|',
  ...Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([license, count]) => `| ${license} | ${count} |`),
  '',
  '## 검토가 필요한 항목 (허용 목록 밖)',
  '',
  review.length === 0
    ? '없음'
    : ['| 패키지 | 버전 | 라이선스 |', '|---|---|---|', ...review.map((i) => `| ${i.name} | ${i.version} | ${i.license} |`)].join('\n'),
  '',
  '## 전체 목록',
  '',
  '| 패키지 | 버전 | 라이선스 | 직접 의존 |',
  '|---|---|---|---|',
  ...all.map((i) => `| ${i.name} | ${i.version} | ${i.license} | ${i.direct ? '예' : ''} |`),
  '',
];
writeFileSync(join(root, 'docs/THIRD_PARTY_NOTICES.md'), lines.join('\n'));

console.log(`패키지 ${all.length}개, 검토 필요 ${review.length}개`);
for (const item of review) console.log(`  검토: ${item.name}@${item.version} (${item.license})`);
