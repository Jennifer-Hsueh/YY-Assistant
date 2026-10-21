import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { isNative } from '../lib/platform';

// 使用說明(內容只有中文;要修改直接改下面的 SECTIONS)
const SECTIONS = [
  { title: '開始使用', web: true, items: [
    'iPhone：用 Safari 開啟網站 → 點下方「分享」→「加入主畫面」，之後從主畫面的 YY手帳 圖示開啟。要收到通知，一定要從主畫面開啟。',
    'Android：用 Chrome 開啟網站 → 右上角選單 →「安裝應用程式」或「加到主畫面」。',
    '登入後會保持 7 天，超過時間會請您重新登入。',
  ] },
  { title: '首頁', items: [
    '一眼看到今天的行程、本月累積消費、預算使用情況和墨箋絮語。',
    '右下角「＋」可以快速記一筆、新增行程或寫一則待辦記事。',
    '方案快到期或有重要公告時，首頁上方會出現提醒。',
  ] },
  { title: '記帳', items: [
    '建議先到「帳戶」建立現金、銀行、信用卡等帳戶，並填入目前金額。',
    '「新增」記一筆收入或支出；「轉帳」在兩個帳戶之間移動金額；「編輯」可以修改或刪除。',
    '「管理分類」可以自訂分類和顏色；日曆檢視會用當天最高一筆支出的分類顏色標示。',
    '「循環」適合房租、訂閱等固定收支，到期會自動入帳。',
    '「統計分析」可以看每月摘要、設定每月預算，以及依條件分析。',
  ] },
  { title: '行事曆', items: [
    '新增行程時可以設定結束時間（可以跨日）、分類顏色和提醒時間。',
    '「循環」適合每週固定的課程、每月的繳費日等。',
    '可以切換月檢視和週檢視，「查詢」可以找過去或未來的行程。',
  ] },
  { title: '墨箋絮語', items: [
    '隨手記下待辦事項，完成後打勾。首頁只顯示還沒完成的項目。',
  ] },
  { title: '社群', items: [
    '「晴空與雨天」分享心情、「養豬小能手」交流理財、「小編許願池」許願新功能，「微光拾憶」是只屬於自己的紀錄。',
    '發文可以選擇僅自己、公開・匿名或公開・暱稱，每篇最多附 3 張照片。',
    '看到不當內容請按文章下方的「檢舉」，並選擇原因。',
    '心情低落需要協助時，請撥打「晴空與雨天」上方的安心專線。',
  ] },
  { title: '通知', items: [
    '到「設定 → 通知設定」分別開啟帳務通知和行程通知，第一次開啟時請允許通知權限。',
    'iPhone 需要 iOS 16.4 以上，而且要從主畫面開啟 YY手帳 才收得到通知。',
  ] },
  { title: '方案', items: [
    '註冊後三個月免費試用全部功能。',
    '試用結束或方案到期（含 7 天寬限期）後，改為免費的基本功能：記帳或行事曆二擇一，每個月可以換一次。',
    '到期前 30、10、3 天和當天，會用 Email 和 App 通知提醒您。',
    '目前的方案和到期日在「設定 → 我的方案」。',
  ] },
  { title: '資料與帳號', items: [
    '「設定 → 資料匯出／備份」可以匯出 Excel 或下載完整備份檔。',
    '忘記密碼：在登入頁點「忘記密碼？」，到信箱收重設連結（30 分鐘內有效）。',
    '「設定 → 刪除帳號」會永久刪除帳號和所有資料，無法復原。',
  ] },
  { title: '常見問題', items: [
    '第一次打開比較慢：伺服器閒置一段時間後需要約 1 分鐘重新啟動，請稍候再試。',
    '收不到重設密碼信：請檢查垃圾信匣；仍然沒有的話，請用「設定 → 故障通報」告訴我們。',
    '收不到通知：確認手機的通知權限已開啟，iPhone 請從主畫面開啟 YY手帳。',
    '其他問題或建議：歡迎使用「設定 → 故障通報」，或到「小編許願池」許願。',
  ] },
];

export default function Help() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const sections = SECTIONS.filter((s) => !(s.web && isNative));

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 pb-40 md:max-w-3xl md:px-8 md:py-10">
      <h1 className="page-title-row page-title mb-4 flex items-center gap-2 font-semibold">
        <HelpCircle className="h-5 w-5 md:hidden" style={{ color: 'var(--ink)' }} />
        使用說明
      </h1>
      <div className="space-y-2">
        {sections.map((s, i) => (
          <details key={s.title} open={i === 0} className="group rounded-xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
              {s.title}
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <ul className="list-disc space-y-1.5 px-4 pb-4 pl-8 text-sm leading-relaxed text-foreground/90">
              {s.items.map((it) => <li key={it}>{it}</li>)}
            </ul>
          </details>
        ))}
      </div>
      <p className="mt-6 flex justify-center gap-4 text-xs text-muted-foreground">
        <Link to="/terms" className="underline">使用條款</Link>
        <Link to="/privacy" className="underline">隱私權政策</Link>
      </p>
    </div>
  );
}
