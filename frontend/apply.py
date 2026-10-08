python3 /tmp/yy-home-images/apply.py# YY手帳：首頁圖片改為從 7 個選項挑選（預設河狸＋6 張角色圖），移除自行上傳
import re
import shutil
from pathlib import Path

ROOT = Path('/workspaces/YY-Assistant')
FE = ROOT / 'frontend/src'
BE = ROOT / 'backend/src'
HERE = Path(__file__).resolve().parent

HOME_IMAGES_CONST = '''const HOME_IMAGES = [
  null,
  '/home-images/yy-1.png',
  '/home-images/yy-2.png',
  '/home-images/yy-3.png',
  '/home-images/yy-4.png',
  '/home-images/yy-5.png',
  '/home-images/yy-6.png',
];

export default function Settings() {'''

SELECT_STATE = '''  const [imageStatus, setImageStatus] = useState('idle');

  async function selectImage(src) {
    setImageStatus('saving');
    try {
      const { profile } = await api.updateProfile({ home_image: src });
      setProfile(profile);
      setImageStatus('idle');
    } catch (err) {
      console.error(err);
      setImageStatus('failed');
    }
  }
'''

PICKER_CARD = '''      <Card className="mb-3">
        <CardContent className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <ImageIcon className="h-4 w-4" />
            {t('settings_home_image')}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {HOME_IMAGES.map((src) => {
              const selected = (profile?.home_image || null) === src;
              return (
                <button
                  key={src || 'default'}
                  type="button"
                  disabled={imageStatus === 'saving'}
                  onClick={() => selectImage(src)}
                  className={`flex aspect-square items-center justify-center overflow-hidden rounded-md border bg-muted/40 p-1 transition-colors ${selected ? 'border-primary ring-2 ring-primary' : 'border-border hover:bg-muted'}`}
                >
                  <img src={src || '/home-watermark-logo.png'} alt="" className="max-h-full max-w-full object-contain" />
                </button>
              );
            })}
          </div>
          {imageStatus === 'failed' && <p className="mt-2 text-xs text-destructive">{t('settings_home_image_failed')}</p>}
        </CardContent>
      </Card>
'''

VALID_NEW = "const valid = home_image === null || (typeof home_image === 'string' && /^\\/home-images\\/yy-[1-6]\\.png$/.test(home_image));"

results = []

# --- Settings.jsx ---
sp = FE / 'pages/Settings.jsx'
s = sp.read_text(encoding='utf-8')
k1 = 0
for pat in (r'(?://[^\n]*\n)*function removeLightBackground\(.*?export default function Settings\(\) \{',
            r'(?://[^\n]*\n)*function resizeImage\(.*?export default function Settings\(\) \{'):
    s, k1 = re.subn(pat, lambda _: HOME_IMAGES_CONST, s, count=1, flags=re.S)
    if k1:
        break
if k1 == 0 and 'function resizeImage' not in s and s.count('export default function Settings() {') == 1:
    s = s.replace('export default function Settings() {', HOME_IMAGES_CONST)
    k1 = 1
s, k2 = re.subn(r"  const \[imageStatus, setImageStatus\] = useState\('idle'\);\n.*?(?=\n  async function clearAllData)",
                lambda _: SELECT_STATE, s, count=1, flags=re.S)
s, k3 = re.subn(r'      <Card className="mb-3">\n        <CardContent className="p-4">\n          <p className="mb-3 flex items-center gap-1\.5 text-sm font-medium">\n            <ImageIcon.*?        </CardContent>\n      </Card>\n',
                lambda _: PICKER_CARD, s, count=1, flags=re.S)
if (k1, k2, k3) != (1, 1, 1):
    raise SystemExit(f'失敗：Settings.jsx 格式和預期不同（{k1},{k2},{k3}），未修改任何檔案')
results.append((sp, s))

# --- Home.jsx：角色圖以高度 280px 顯示 ---
hp = FE / 'pages/Home.jsx'
h = hp.read_text(encoding='utf-8')
for old, new in [
    ("style={{ maxWidth: 'none' }}",
     "style={{ maxWidth: 'none', ...(profile?.home_image ? { width: 'auto', height: '280px' } : {}) }}"),
    ("style={{ maxWidth: 'none', marginTop: -homeImgH / 2 }}",
     "style={{ maxWidth: 'none', width: 'auto', height: '280px', marginTop: -homeImgH / 2 }}"),
]:
    if h.count(old) != 1:
        raise SystemExit(f'失敗：Home.jsx 找不到原程式碼，未修改任何檔案\n{old}')
    h = h.replace(old, new)
results.append((hp, h))

# --- 後端：只接受 7 個選項 ---
pp = BE / 'controllers/profileController.js'
p = pp.read_text(encoding='utf-8')
p, k = re.subn(r'const valid = home_image === null.*?;\n', lambda _: VALID_NEW + '\n', p, count=1, flags=re.S)
if k != 1:
    raise SystemExit('失敗：profileController.js 格式和預期不同，未修改任何檔案')
results.append((pp, p))

# --- 文字 ---
lp = FE / 'context/LanguageContext.jsx'
l = lp.read_text(encoding='utf-8')
for old, new in [
    ("settings_home_image_failed: '上傳失敗，請換一張圖片再試',", "settings_home_image_failed: '儲存失敗，請稍後再試',"),
    ("settings_home_image_failed: 'Upload failed, please try another image',", "settings_home_image_failed: 'Failed to save, please try again',"),
]:
    if l.count(old) != 1:
        raise SystemExit(f'失敗：LanguageContext.jsx 找不到原程式碼，未修改任何檔案\n{old}')
    l = l.replace(old, new)
results.append((lp, l))

for path, text in results:
    path.write_text(text, encoding='utf-8')
    print('已更新', path.name)

dst = ROOT / 'frontend/public/home-images'
dst.mkdir(parents=True, exist_ok=True)
for f in sorted((HERE / 'home-images').glob('*.png')):
    shutil.copyfile(f, dst / f.name)
print('已新增 6 張圖片到 frontend/public/home-images')
print('完成')
