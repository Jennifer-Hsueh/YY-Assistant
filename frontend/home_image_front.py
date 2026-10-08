# YY手帳：首頁圖片移到卡片前面（點擊仍會穿透到卡片）
from pathlib import Path

p = Path('/workspaces/YY-Assistant/frontend/src/pages/Home.jsx')
s = p.read_text(encoding='utf-8')
edits = [
    ('`pointer-events-none fixed bottom-', '`pointer-events-none fixed z-20 bottom-'),
    ('className="pointer-events-none relative z-0 ml-auto', 'className="pointer-events-none relative z-20 ml-auto'),
]
for old, new in edits:
    if new in s:
        continue
    if s.count(old) != 1:
        raise SystemExit(f'失敗：Home.jsx 找不到原程式碼，未修改任何檔案\n{old}')
    s = s.replace(old, new)
p.write_text(s, encoding='utf-8')
print('已更新 Home.jsx')
print('完成')
