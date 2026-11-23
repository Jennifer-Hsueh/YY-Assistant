import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBeta } from '../lib/useBeta';
import { useLanguage, HTML_LANG } from '../context/LanguageContext';
import LanguageMenu from '../components/LanguageMenu';
import './landingBook.css';

// 入口頁(未登入的網頁訪客看到;已登入直接進手帳首頁,APP 版直接到登入頁)
// 一本可以翻的介紹書:封面 → 目次|序 → 六章(左頁文字、右頁畫面)→ 方案 → 版權頁|封底
// 截圖在 public/landing/book/(英文版在 public/landing/book/en/),用示範資料產生

const PRICES = [[null, null], [69, 728], [69, 728], [69, 728], [79, 848], [109, 1208]];

const COPY = {
  zh: {
    docTitle: 'YY手帳 Assistant｜把每一天，好好收進一本書裡',
    langSwitch: 'EN',
    toToc: '‹ 回目錄頁',
    login: '登入',
    cta: '免費開始',
    ctaFull: '測試名額已滿',
    betaLine: (limit, remaining) => `測試版・目前開放 ${limit} 位測試者，還有 ${remaining} 個名額`,
    betaFullLine: (limit) => `${limit} 位測試名額已滿，謝謝你的關注`,
    foundingLine: '🦫 測試期間使用滿 5 天，正式上線後送你一年全功能',
    cover: { kicker: 'A NOTEBOOK FOR EVERY DAY', title: ['YY', '手帳'], tag: ['把每一天，', '好好收進一本書裡'], by: '歪歪手帳', open: '翻開 →', aria: '翻開這本書' },
    prev: '← 上一頁',
    next: '下一頁 →',
    coverLabel: '封面',
    backLabel: '封底',
    zoom: '放大',
    zoomAria: (c) => `放大：${c}`,
    close: '關閉',
    tocRun: '目次',
    tocTitle: '目次',
    appendixMark: '附',
    treeAlt: '小河狸的樹屋',
    preface: {
      run: '序',
      title: '給正在好好過日子的你',
      intro: '這本小手帳裡，有幾樣東西會陪著你：',
      feats: ['記帳本，看清楚錢花去了哪裡', '行事曆，記住每個約定和紀念日', 'To Do 和小紙條，收下零碎的事和想說的話', '小河狸的家，把心情變成窗外的天氣', '每個月一本書，放進樹屋的書櫃'],
      paras: [
        '不用每天都記得很完整。忙的時候少寫一點，累的時候只選一個今天的心情，這樣就很好了。',
        '在這裡寫下的文章，不會有批評，也不會有責備。開心的、難過的、說不出口的，都可以放心寫下來；在這裡，你可以找到屬於自己的樹洞。',
        '你已經很努力了。剩下的，交給這本手帳慢慢收好。',
      ],
    },
    chapters: [
      { run: '第一章', title: '記帳，清清楚楚', paras: ['日常、旅行、家用，可以分成好幾本帳本記。帳戶依銀行排好，總資產一眼看懂；信用卡可以設成「允許負數」。', '設好總預算和分類預算，快超支時會提醒你。房租、訂閱這種每個月固定的，設成循環記帳，時間到自動入帳。', '和家人一起用的話，開一本共同帳本：誰記了哪一筆，一看就知道。'], figs: [['ledger', '記帳列表'], ['shared', '共同帳本']] },
      { run: '第二章', title: '行程與紀念日', paras: ['月曆、週曆都看得清楚，跨好幾天的旅行也排得下。循環行程可以設時間，到了會準時通知你。', '紀念日會倒數、算週年；好友的生日，小河狸會提早提醒。', '全家人的行程，可以放進同一本共用行事曆；共同行程也能邀請好友一起參加。'], figs: [['calendar', '行事曆・月曆檢視']] },
      { run: '第三章', title: 'To Do 與小紙條', paras: ['首頁的「墨箋絮語」是一張隨手的待辦清單：想到什麼就寫一行，按 Enter 新增，做完打個勾。', '「小紙條」是寫給重要的人的一句話，最多 25 個字。對方打開 App 時，紙條會輕輕跳出來；可以回覆、收下，或撕掉。', '「晚餐我買單」、「到家說一聲」，有些話不用長，記得說就好。'], figs: [['home2', '墨箋絮語與小紙條'], ['slip', '收到小紙條']] },
      { run: '第四章', title: '每個月，一本書', paras: ['每月一號，小河狸把上個月整理成一本月刊：本月概況、行事曆、心情月曆、生活照片，還有你寫下的文章。', '七號以前，挑一張封面、寫一句給這個月的話，它就會定稿，放上你的書櫃。想留下來的話，也可以下載成 A5 的 PDF。', '每年一月，還會多一本年鑑：一整年的收支圓餅圖、十二個月的心情，和寫給自己的話。'], figs: [['bookshelf', '樹屋書櫃']] },
      { run: '第五章', title: '小河狸的家與日常時光', paras: ['打開小河狸的家，今天的心情會變成窗外的天氣：晴天、陰天，或是下著小雨。', '每天貼一張生活照片、寫一句話，就是「日常時光」。照片會掛在小河狸家的相框裡，也會收進月刊。', '點點牆上的月曆、桌上的待辦、角落的書櫃，看看今天過得怎麼樣。'], figs: [['room', '小河狸的家'], ['moments', '日常時光']] },
      { run: '第六章', title: '溫柔的小社群', paras: ['在「晴空與雨天」說說今天的心情，會收到小河狸的抱抱和大家的加油；在「微光拾憶」記下生活裡的小確幸。', '每一篇都可以選擇匿名、只給好友看，或只寫給自己。'], figs: [['community', '晴空與雨天']] },
    ],
    plans: {
      run: '附錄',
      title: '方案與價格',
      head: ['方案', '月繳', '年繳'],
      free: '免費',
      rows: [
        ['基本功能', '記帳或行事曆二選一，每月可換一次'],
        ['進階 A', '記帳＋行事曆的基本功能'],
        ['進階 B', '記帳＋循環記帳、通知、本日心情、匯出備份'],
        ['進階 C', '行事曆＋循環行程、通知、本日心情、匯出備份'],
        ['進階＋社群', 'A／B／C 任一方案加購社群'],
        ['完整版', '全部功能，包含社群和日常時光'],
      ],
      unit: '單位：新台幣元。年繳 = 月費 × 12 − 100 元。',
      notesRun: '方案說明',
      notes: [
        ['先免費用三個月', '註冊後三個月，全部功能都能用。到期前 30 天、10 天、3 天和當天，都會提醒你。'],
        ['之後也能免費用', '試用結束後，改為基本功能：記帳或行事曆二選一，每個月可以換一次。資料不會被刪除，升級後馬上恢復。'],
        ['每個方案都有的', '多帳本、共同帳本、共用行事曆、紀念日、好友、小紙條、月刊書櫃、小河狸的家。'],
        ['不會自動扣款', '用銀行轉帳付款，在「設定 → 我的方案」回報匯款，約 1～2 個工作天開通。到期後還有 7 天寬限期，功能照常。'],
      ],
    },
    colophon: {
      name: 'YY手帳 Assistant',
      lines: ['網頁版：yy-assistant-front.onrender.com', 'iPhone：用 Safari 開啟，點「分享」→「加入主畫面」', 'Android：用 Chrome 開啟，點選單 →「安裝應用程式」；App 即將在 Google Play 推出', '客服：happybusybeaver@gmail.com'],
      terms: '使用條款',
      privacy: '隱私權政策',
      deleteAcc: '刪除帳號',
      copy: '© 2026 歪歪手帳',
    },
    back: { kicker: 'THE END — AND YOUR FIRST PAGE', title: ['讀完了這本，', '換你寫自己的。'] },
  },
  en: {
    docTitle: 'YY Assistant | Every day, kept neatly in a book',
    langSwitch: '中文',
    toToc: '‹ Contents',
    login: 'Log in',
    cta: 'Start free',
    ctaFull: 'Beta is full',
    betaLine: (limit, remaining) => `Beta: open to ${limit} testers, ${remaining} spots left`,
    betaFullLine: (limit) => `All ${limit} beta spots are taken. Thanks for your interest`,
    foundingLine: '🦫 Use it on 5 days during the beta, get 1 year of full access free after launch',
    cover: { kicker: 'A NOTEBOOK FOR EVERY DAY', title: ['YY', 'Assistant'], tag: ['Every day,', 'kept neatly in a book'], by: 'YY Assistant', open: 'Open →', aria: 'Open this book' },
    prev: '← Previous',
    next: 'Next →',
    coverLabel: 'Cover',
    backLabel: 'Back cover',
    zoom: 'Zoom',
    zoomAria: (c) => `Zoom in: ${c}`,
    close: 'Close',
    tocRun: 'CONTENTS',
    tocTitle: 'Contents',
    appendixMark: 'A',
    treeAlt: 'Beaver’s treehouse',
    preface: {
      run: 'PREFACE',
      title: 'For you, living each day well',
      intro: 'This little notebook keeps a few things for you:',
      feats: ['A ledger, to see where your money goes', 'A calendar, for every plan and anniversary', 'To Dos and little notes, for small tasks and kind words', 'Beaver’s home, where your mood becomes the weather', 'A book every month, on the treehouse shelf'],
      paras: [
        'You don’t have to write it all down every day. Write a little when you’re busy, and on tired days just pick today’s mood. That’s more than enough.',
        'What you write here meets no criticism and no blame. Happy things, sad things, things you can’t say out loud: write them freely. Here you’ll find a quiet place that is all yours.',
        'You’ve worked so hard already. Let this notebook keep the rest.',
      ],
    },
    chapters: [
      { run: 'CHAPTER I', title: 'Money, made clear', paras: ['Keep separate ledgers for daily life, trips and home. Accounts are grouped by bank so your total assets are clear at a glance, and a credit card can be allowed to go negative.', 'Set an overall budget and category budgets, and you’ll be reminded before you overspend. Rent, subscriptions and other fixed costs can be recurring entries that add themselves on time.', 'Using it with family? Open a shared ledger and see who recorded what.'], figs: [['ledger', 'Ledger'], ['shared', 'Shared ledger']] },
      { run: 'CHAPTER II', title: 'Plans and anniversaries', paras: ['See the month or the week clearly, with room for trips that last several days. Recurring events can have a time, and you’ll be notified right on schedule.', 'Anniversaries count down and count the years, and Beaver reminds you of friends’ birthdays ahead of time.', 'Put the whole family’s plans in one shared calendar, and invite friends to join shared events.'], figs: [['calendar', 'Calendar, month view']] },
      { run: 'CHAPTER III', title: 'To Dos and little notes', paras: ['Ink Notes on Home is a quick to-do list: write a line when something comes to mind, press Enter to add it, and tick it off when it’s done.', 'A little note is one line, up to 25 characters, for someone who matters. It pops up gently when they open the app, and they can reply, keep it or tear it up.', '“Dinner’s on me.” “Text me when you’re home.” Some things don’t need many words.'], figs: [['home2', 'Ink Notes and little notes'], ['slip', 'A little note arrives']] },
      { run: 'CHAPTER IV', title: 'A book every month', paras: ['On the 1st, Beaver gathers last month into a book: an overview, your calendar, a mood calendar, daily photos and the posts you wrote.', 'Before the 7th, pick a cover and write a line to the month. It’s then finalized and placed on your shelf, and you can download it as an A5 PDF.', 'Every January brings a yearbook too: a pie chart of the year’s money, twelve months of moods, and a note to yourself.'], figs: [['bookshelf', 'Treehouse bookshelf']] },
      { run: 'CHAPTER V', title: 'Beaver’s home and daily moments', paras: ['Open Beaver’s home and today’s mood becomes the weather outside: sunny, cloudy, or a light drizzle.', 'Post a photo of your day with a line of words, and that’s a daily moment. It hangs in the frame in Beaver’s home and goes into your monthly book.', 'Tap the calendar on the wall, the to-dos on the desk and the shelf in the corner to see how today went.'], figs: [['room', 'Beaver’s home'], ['moments', 'Daily moments']] },
      { run: 'CHAPTER VI', title: 'A gentle community', paras: ['Share how you feel in Sun & Rain and get hugs from Beaver and cheers from others. Keep small moments of joy in Glimmers.', 'Every post can be anonymous, for friends only, or just for yourself.'], figs: [['community', 'Sun & Rain']] },
    ],
    plans: {
      run: '\u00a0',
      title: 'Plans and pricing',
      head: ['Plan', 'Monthly', 'Yearly'],
      free: 'Free',
      rows: [
        ['Basic', 'Budget or calendar, switch once a month'],
        ['Plus A', 'Basic budget and calendar'],
        ['Plus B', 'Budget, recurring, notifications, mood, export'],
        ['Plus C', 'Calendar, recurring, notifications, mood, export'],
        ['Plus + Community', 'Any Plus plan with community'],
        ['Complete', 'Everything, incl. community and daily moments'],
      ],
      unit: 'Prices in NT$. Yearly = monthly × 12 − 100.',
      notesRun: 'NOTES',
      notes: [
        ['Free for three months', 'Every feature is yours for three months after you sign up, with reminders 30, 10 and 3 days before it ends.'],
        ['Still free afterward', 'Then you move to Basic: budget or calendar, switch once a month. Your data is never deleted, and upgrading brings it all back.'],
        ['In every plan', 'Multiple and shared ledgers, shared calendars, anniversaries, friends, little notes, the monthly bookshelf and Beaver’s home.'],
        ['Nothing renews automatically', 'Pay by bank transfer and report it in Settings → My plan; it’s activated in about 1–2 business days. There’s a 7-day grace period after it ends.'],
      ],
    },
    colophon: {
      name: 'YY Assistant',
      lines: ['Web: yy-assistant-front.onrender.com', 'iPhone: open in Safari, tap Share → Add to Home Screen', 'Android: open in Chrome, tap the menu → Install app. Coming soon to Google Play', 'Contact: happybusybeaver@gmail.com'],
      terms: 'Terms of use',
      privacy: 'Privacy policy',
      deleteAcc: 'Delete account',
      copy: '© 2026 YY Assistant',
    },
    back: { kicker: 'THE END — AND YOUR FIRST PAGE', title: ['You’ve read this one.', 'Now write your own.'] },
  },
  ja: {
    docTitle: 'YY手帳｜毎日を、一冊の本にていねいに',
    langSwitch: '日本語',
    toToc: '‹ 目次へ',
    login: 'ログイン',
    cta: '無料ではじめる',
    ctaFull: 'ベータ版は満員です',
    betaLine: (limit, remaining) => `ベータ版：${limit} 名まで参加できます（残り ${remaining} 名）`,
    betaFullLine: (limit) => `ベータ版の募集枠 ${limit} 名は満員になりました。ご関心ありがとうございます`,
    foundingLine: '🦫 ベータ期間中に 5 日使うと、正式リリース後に全機能を 1 年間プレゼント',
    cover: { kicker: 'A NOTEBOOK FOR EVERY DAY', title: ['YY', '手帳'], tag: ['毎日を、', '一冊の本にていねいに'], by: 'YY手帳', open: 'ひらく →', aria: 'この本をひらく' },
    prev: '← 前へ',
    next: '次へ →',
    coverLabel: '表紙',
    backLabel: '裏表紙',
    zoom: '拡大',
    zoomAria: (c) => `拡大：${c}`,
    close: '閉じる',
    tocRun: '目次',
    tocTitle: '目次',
    appendixMark: '付',
    treeAlt: 'ビーバーのツリーハウス',
    preface: {
      run: 'はじめに',
      title: 'ていねいに暮らすあなたへ',
      intro: 'この小さな手帳には、あなたに寄りそうものがいくつか入っています。',
      feats: ['家計簿：お金の行き先がはっきりわかる', 'カレンダー：約束も記念日も忘れない', 'To Do とひとことレター：細かな用事と伝えたい言葉を', 'ビーバーのおうち：気分が窓の外の天気に', '毎月一冊の本：ツリーハウスの本棚へ'],
      paras: [
        '毎日きちんと書かなくても大丈夫。忙しい日は少しだけ、疲れた日は今日の気分をひとつ選ぶだけで十分です。',
        'ここに書いたことが、批判されたり責められたりすることはありません。うれしいことも、悲しいことも、口に出せないことも、安心して書いてください。ここは、あなただけの秘密の場所です。',
        'あなたはもう十分がんばっています。あとは、この手帳がゆっくり受け止めます。',
      ],
    },
    chapters: [
      { run: '第一章', title: '家計簿をすっきりと', paras: ['日々の生活、旅行、家族のお金。家計簿を何冊にも分けて記録できます。口座は銀行ごとに並び、総資産がひと目でわかります。クレジットカードは「マイナスを許可」にできます。', '総予算とカテゴリ別の予算を決めておけば、使いすぎる前にお知らせします。家賃やサブスクなど毎月決まった支出は、繰り返し記録にしておけば自動で記帳されます。', '家族と使うなら共有家計簿を。誰がどれを記録したか、すぐにわかります。'], figs: [['ledger', '家計簿'], ['shared', '共有家計簿']] },
      { run: '第二章', title: '予定と記念日', paras: ['月表示も週表示も見やすく、何日も続く旅行も入れられます。繰り返しの予定には時間を設定でき、時間になったらお知らせします。', '記念日はカウントダウンと周年を表示。友だちの誕生日は、ビーバーが前もって教えてくれます。', '家族みんなの予定は、ひとつの共有カレンダーにまとめられます。共有の予定に友だちを招待することもできます。'], figs: [['calendar', 'カレンダー・月表示']] },
      { run: '第三章', title: 'To Do とひとことレター', paras: ['ホームの「墨箋メモ」は、思いついたときに書けるやることリスト。一行書いて Enter で追加、終わったらチェックを入れます。', '「ひとことレター」は、大切な人に送るひとこと。25 文字まで書けます。相手がアプリを開くと、そっと飛び出します。返事を書く、受け取る、破る、を選べます。', '「晩ごはんはおごるね」「家に着いたら教えて」。短くても、伝えることが大切な言葉があります。'], figs: [['home2', '墨箋メモとひとことレター'], ['slip', 'レターが届いたとき']] },
      { run: '第四章', title: '毎月、一冊の本に', paras: ['毎月 1 日、ビーバーが先月を一冊の月刊ブックにまとめます。今月の概要、カレンダー、気分のカレンダー、写真、そしてあなたが書いた投稿。', '7 日までに表紙を選び、その月へのひとことを書くと完成して本棚に並びます。A5 サイズの PDF でダウンロードすることもできます。', '毎年 1 月には年鑑も。一年の収支の円グラフ、12 か月の気分、そして自分へのメッセージが入ります。'], figs: [['bookshelf', 'ツリーハウスの本棚']] },
      { run: '第五章', title: 'ビーバーのおうちと日々のひとコマ', paras: ['ビーバーのおうちを開くと、今日の気分が窓の外の天気になります。晴れ、くもり、それとも小雨。', '毎日一枚の写真とひとことを残せば、それが「日々のひとコマ」。写真はビーバーのおうちの写真立てに飾られ、月刊ブックにも入ります。', '壁のカレンダー、机のやること、すみの本棚をタップして、今日がどんな一日だったか見てみましょう。'], figs: [['room', 'ビーバーのおうち'], ['moments', '日々のひとコマ']] },
      { run: '第六章', title: 'やさしいコミュニティ', paras: ['「晴れと雨」で今日の気持ちを話すと、ビーバーのハグとみんなの応援が届きます。「ひかりのかけら」には、毎日の小さなしあわせを残しましょう。', '投稿ごとに、匿名・友だちのみ・自分だけ、を選べます。'], figs: [['community', '晴れと雨']] },
    ],
    plans: {
      run: '付録',
      title: 'プランと料金',
      head: ['プラン', '月払い', '年払い'],
      free: '無料',
      rows: [
        ['ベーシック', '家計簿かカレンダーのどちらか。毎月 1 回切り替え可'],
        ['アドバンス A', '家計簿＋カレンダーの基本機能'],
        ['アドバンス B', '家計簿＋繰り返し、通知、今日の気分、エクスポート'],
        ['アドバンス C', 'カレンダー＋繰り返し、通知、今日の気分、エクスポート'],
        ['アドバンス＋コミュニティ', 'A／B／C にコミュニティを追加'],
        ['コンプリート', 'すべての機能（コミュニティ、日々のひとコマを含む）'],
      ],
      unit: '単位：台湾ドル（TWD）。年払い = 月額 × 12 − 100。',
      notesRun: 'プランについて',
      notes: [
        ['最初の 3 か月は無料', '登録から 3 か月間、すべての機能を使えます。終了の 30 日前、10 日前、3 日前と当日にお知らせします。'],
        ['そのあとも無料で使えます', '無料期間が終わるとベーシックになります。家計簿かカレンダーのどちらかを選び、毎月 1 回切り替えられます。データは消えず、アップグレードするとすぐに戻ります。'],
        ['どのプランにもあるもの', '複数の家計簿、共有家計簿、共有カレンダー、記念日、友だち、ひとことレター、本棚、ビーバーのおうち。'],
        ['自動で引き落とされません', 'お支払いは銀行振込です。「設定 → マイプラン」から振込を報告すると、1〜2 営業日で有効になります。期限後も 7 日間の猶予期間があります。'],
      ],
    },
    colophon: {
      name: 'YY手帳 Assistant',
      lines: ['ウェブ版：yy-assistant-front.onrender.com', 'iPhone：Safari で開き、「共有」→「ホーム画面に追加」', 'Android：Chrome で開き、メニュー →「アプリをインストール」。Google Play にも近日公開', 'お問い合わせ：happybusybeaver@gmail.com'],
      terms: '利用規約',
      privacy: 'プライバシーポリシー',
      deleteAcc: 'アカウントの削除',
      copy: '© 2026 YY手帳',
    },
    back: { kicker: 'THE END — AND YOUR FIRST PAGE', title: ['読み終えたら、', '次はあなたの番です。'] },
  },
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const LAST = 9; // 0 = 封面,1～9 = 跨頁

function CTA({ T, full, className = '' }) {
  if (full) return <span className={`yb-btn is-off ${className}`}>{T.ctaFull}</span>;
  return <Link to="/register" className={`yb-btn is-gold ${className}`}>{T.cta}</Link>;
}

export default function Landing() {
  const { language } = useLanguage();
  const beta = useBeta();
  const full = !!beta?.full;
  const en = language !== 'zh'; // 截圖：中文以外先用英文截圖
  const latin = language === 'en'; // 英文才把章名改成 CHAPTER
  const T = COPY[language] || COPY.en;
  const shot = (name) => `/landing/book/${en ? 'en/' : ''}${name}.webp`;

  const [page, setPage] = useState(0);
  const [dir, setDir] = useState('f');
  const [zoom, setZoom] = useState(null); // 放大中的截圖 [src, 說明]
  const bookRef = useRef(null);
  const touch = useRef(null);

  const go = (n) => {
    const to = Math.max(0, Math.min(LAST, n));
    if (to === page) return;
    setDir(to > page ? 'f' : 'b');
    setPage(to);
    setZoom(null);
    // 手機上一頁很長:翻頁後回到書的開頭
    const top = bookRef.current?.getBoundingClientRect().top;
    if (top !== undefined && top < 0) bookRef.current.scrollIntoView({ block: 'start' });
  };

  useEffect(() => {
    // 書用的字型只在入口頁載入
    const id = 'landing-book-font';
    if (!document.getElementById(id)) {
      const l = document.createElement('link');
      l.id = id;
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;500;600;900&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap';
      document.head.appendChild(l);
    }
    return () => { document.title = 'YY手帳'; };
  }, []);
  useEffect(() => {
    // 日文版用日本的明朝體(漢字字形才是日本的寫法)
    const id = 'landing-book-font-ja';
    if (language !== 'ja' || document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id;
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600;900&display=swap';
    document.head.appendChild(l);
  }, [language]);
  useEffect(() => {
    document.title = T.docTitle;
    document.documentElement.lang = HTML_LANG[language] || 'zh-Hant';
  }, [T, language]);

  // 鍵盤:左右鍵翻頁,Esc 關閉放大
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (zoom) { if (e.key === 'Escape') setZoom(null); return; }
      if (e.key === 'ArrowRight') go(page + 1);
      if (e.key === 'ArrowLeft') go(page - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    if (!zoom) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [zoom]);

  // 手機左右滑動翻頁
  const onTouchStart = (e) => { const t = e.touches[0]; touch.current = [t.clientX, t.clientY]; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current[0];
    const dy = t.clientY - touch.current[1];
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(page + (dx < 0 ? 1 : -1));
  };

  let fig = 0;
  const figNo = T.chapters.map((c) => c.figs.map(() => ++fig));

  const figure = (name, caption, no) => (
    <figure key={name} className="yb-fig">
      <button type="button" className="yb-zoom" onClick={() => setZoom([shot(name), caption])} aria-label={T.zoomAria(caption)}>
        <img src={shot(name)} alt={caption} width="390" height="844" loading="lazy" decoding="async" />
      </button>
      <figcaption className="yb-cap"><b>Fig. {no}</b>{caption}</figcaption>
      <button type="button" className="yb-figact" onClick={() => setZoom([shot(name), caption])}>{T.zoom}</button>
    </figure>
  );

  const toc = [...T.chapters.map((c, i) => [ROMAN[i], c.title, 3 + i * 2]), [T.appendixMark, T.plans.title, 15]];

  const spreads = [
    // 1:目次|序
    [
      <div key="l" className="yb-page l">
        <div className="yb-run">{T.tocRun}</div>
        <h2 className="yb-h" style={{ marginBottom: 18 }}>{T.tocTitle}</h2>
        <ol className="yb-toc">
          {toc.map(([n, title, p]) => <li key={n}><span className="n">{n}</span>{title}<span className="p">{p}</span></li>)}
        </ol>
        <img className="yb-toc-art" src="/landing/book/treehouse.webp" alt={T.treeAlt} width="150" height="150" />
        <span className="yb-folio">1</span>
      </div>,
      <div key="r" className="yb-page r yb-pref">
        <div className="yb-run">{T.preface.run}</div>
        <h2 className="yb-h">{T.preface.title}</h2>
        <p className="yb-body" style={{ marginBottom: 8 }}>{T.preface.intro}</p>
        <ul className="yb-feat">{T.preface.feats.map((f) => <li key={f}><span>・</span>{f}</li>)}</ul>
        {T.preface.paras.map((p) => <p key={p} className="yb-body">{p}</p>)}
        <span className="yb-folio">2</span>
      </div>,
    ],
    // 2～7:各章(左頁文字、右頁畫面)
    ...T.chapters.map((c, i) => [
      <div key="l" className="yb-page l">
        <div className="yb-run">{latin ? '\u00a0' : c.run}</div>
        <span className="yb-chap">{latin ? c.run : `CHAPTER ${ROMAN[i]}`}</span>
        <h2 className="yb-h">{c.title}</h2>
        {c.paras.map((p) => <p key={p} className="yb-body">{p}</p>)}
        <span className="yb-folio">{3 + i * 2}</span>
      </div>,
      <div key="r" className="yb-page r is-center">
        {c.figs.length > 1
          ? <div className="yb-pair">{c.figs.map(([name, cap], k) => figure(name, cap, figNo[i][k]))}</div>
          : figure(c.figs[0][0], c.figs[0][1], figNo[i][0])}
        <span className="yb-folio">{4 + i * 2}</span>
      </div>,
    ]),
    // 8:方案與價格|方案說明
    [
      <div key="l" className="yb-page l">
        <div className="yb-phead">
          <div className="yb-run">{T.plans.run}</div>
          <span className="yb-chap">APPENDIX</span>
          <h2 className="yb-h">{T.plans.title}</h2>
        </div>
        <table className="yb-ptab">
          <thead><tr><th>{T.plans.head[0]}</th><th className="r">{T.plans.head[1]}</th><th className="r">{T.plans.head[2]}</th></tr></thead>
          <tbody>
            {T.plans.rows.map(([name, desc], k) => { const [m, y] = PRICES[k]; return (
              <tr key={name}>
                <td>{name}<div className="d">{desc}</div></td>
                {m ? <><td className="r num">{m}</td><td className="r num">{y.toLocaleString()}</td></> : <><td className="r">{T.plans.free}</td><td className="r">—</td></>}
              </tr>
            ); })}
          </tbody>
        </table>
        <p className="yb-pnote-unit">{T.plans.unit}</p>
        <span className="yb-folio">15</span>
      </div>,
      <div key="r" className="yb-page r">
        <div className="yb-phead"><div className="yb-big">{T.plans.notesRun}</div></div>
        <dl className="yb-pnote">
          {T.plans.notes.map(([dt, dd]) => <Fragment key={dt}><dt>{dt}</dt><dd>{dd}</dd></Fragment>)}
        </dl>
        <span className="yb-folio">16</span>
      </div>,
    ],
    // 9:版權頁|封底
    [
      <div key="l" className="yb-page l" style={{ justifyContent: 'flex-end' }}>
        <div className="yb-colo">
          <strong>{T.colophon.name}</strong>
          {T.colophon.lines.map((x) => <div key={x}>{x}</div>)}
          <div className="yb-colo-links">
            <Link to="/terms">{T.colophon.terms}</Link>
            <Link to="/privacy">{T.colophon.privacy}</Link>
            <Link to="/delete-account">{T.colophon.deleteAcc}</Link>
          </div>
          <div style={{ marginTop: 10, color: '#9A8F7E' }}>{T.colophon.copy}</div>
        </div>
        <span className="yb-folio">17</span>
      </div>,
      <div key="r" className="yb-page r yb-back">
        <div className="yb-back-shade" aria-hidden="true" />
        <div className="num" style={{ fontSize: 15, letterSpacing: '.35em' }}>{T.back.kicker}</div>
        <h2 className="serif">{T.back.title[0]}<br />{T.back.title[1]}</h2>
        <CTA T={T} full={full} />
      </div>,
    ],
  ];

  const label = page === 0 ? T.coverLabel : page === LAST ? T.backLabel : `${page} / ${LAST - 1}`;
  const turn = dir === 'b' ? 'yb-turn-b' : 'yb-turn-f';

  return (
    <div className="ybook" lang={COPY[language] ? HTML_LANG[language] : 'en'}>
      <header className="yb-head">
        <div className="yb-headl">
          <button type="button" className="yb-btn yb-totoc" onClick={() => go(1)} disabled={page === 1} style={page === 1 ? { visibility: 'hidden' } : undefined}>{T.toToc}</button>
          <button type="button" className="yb-brand" onClick={() => go(0)} aria-label="YY手帳"><b>YY手帳</b><i className="num">Assistant</i></button>
        </div>
        <nav className="yb-nav">
          <LanguageMenu className="yb-btn" style={{ border: 0, background: 'none', padding: '0 8px', color: '#C9B994' }} />
          <Link to="/login" className="yb-btn">{T.login}</Link>
          <CTA T={T} full={full} />
        </nav>
      </header>

      {beta?.active && (
        <div className="yb-beta">
          <div>{full ? T.betaFullLine(beta.limit) : T.betaLine(beta.limit, beta.remaining)}</div>
          {!full && <div>{T.foundingLine}</div>}
        </div>
      )}

      <main ref={bookRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ scrollMarginTop: 12 }}>
        {page === 0 ? (
          <div key="cover" className={turn}>
            <button type="button" className="yb-cover" onClick={() => go(1)} aria-label={T.cover.aria}>
              <span className="yb-cover-shade" aria-hidden="true" />
              <span className="yb-cover-frame" aria-hidden="true" />
              <span className="yb-cover-in">
                <span>
                  <span className="num yb-cover-kicker" style={{ display: 'block' }}>{T.cover.kicker}</span>
                  <span className={`serif yb-cover-title ${latin ? 'is-en' : ''}`} style={{ display: 'block' }}>{T.cover.title[0]}<br />{T.cover.title[1]}</span>
                </span>
                <span>
                  <span className="serif yb-cover-tag" style={{ display: 'block' }}>{T.cover.tag[0]}<br />{T.cover.tag[1]}</span>
                  <span className="serif yb-cover-foot"><span>{T.cover.by}</span><span>{T.cover.open}</span></span>
                </span>
              </span>
            </button>
          </div>
        ) : (
          <div key={page} className={`yb-spread ${turn}`}>{spreads[page - 1]}</div>
        )}
      </main>

      <div className="yb-pager">
        <button type="button" className="yb-btn" onClick={() => go(page - 1)} disabled={page === 0}>{T.prev}</button>
        <span className="num" aria-live="polite">{label}</span>
        <button type="button" className="yb-btn" onClick={() => go(page + 1)} disabled={page === LAST}>{T.next}</button>
      </div>

      {zoom && (
        <div className="yb-lb" role="dialog" aria-modal="true" aria-label={zoom[1]} onClick={() => setZoom(null)}>
          <div className="yb-lb-phone"><img src={zoom[0]} alt={zoom[1]} /></div>
          <button type="button" className="yb-btn" onClick={() => setZoom(null)}>{T.close}</button>
        </div>
      )}
    </div>
  );
}
