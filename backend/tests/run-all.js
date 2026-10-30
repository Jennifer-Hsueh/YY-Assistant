// 後端測試:每個 *.test.js 用假的資料庫(記憶體)直接呼叫 controller,不會連到真正的 Supabase
// 執行:cd backend && npm test   (GitHub Actions 每次推送 backend/ 時也會自動執行)
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], {
    encoding: 'utf8', timeout: 60000, env: { ...process.env, SENTRY_DSN: '', FIREBASE_SERVICE_ACCOUNT: '' },
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const pass = (out.match(/^PASS /gm) || []).length;
  const fails = out.split('\n').filter((l) => l.startsWith('FAIL '));
  const crashed = r.status !== 0 && fails.length === 0 && !/ALL PASS/.test(out) && pass === 0;
  const ok = fails.length === 0 && !crashed && pass > 0;
  console.log(`${ok ? '✓' : '✗'} ${f}  (${pass} passed${fails.length ? `, ${fails.length} failed` : ''})`);
  if (!ok) {
    failed += 1;
    fails.forEach((l) => console.log(`    ${l}`));
    if (crashed || pass === 0) console.log(out.split('\n').slice(-15).map((l) => `    ${l}`).join('\n'));
  }
}
console.log(failed ? `\n${failed} 個測試檔失敗` : `\n全部 ${files.length} 個測試檔通過`);
process.exit(failed ? 1 : 0);
