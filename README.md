# 獨立 APP 專案(line-life-app 的獨立版本)

PWA 形式的個人助理應用,包含記帳、行事曆、帳戶管理、循環提醒等模組(MVP 範圍)。

## 目錄結構

```
standalone-app/
├── backend/     Node.js/Express 後端 API,部署於 Render
└── frontend/    React + Vite + Tailwind + PWA 前端
```

## 後端啟動方式

```bash
cd backend
npm install
cp .env.example .env    # 填入真實的 Supabase / JWT / Resend 等金鑰
npm run dev              # 開發模式,預設監聽 http://localhost:3000
```

啟動前記得先到 Supabase SQL editor 執行 `backend/supabase_schema.sql`,建立所需的資料表。

## 前端啟動方式

```bash
cd frontend
npm install
npm run dev              # 開發模式,預設 http://localhost:5173
```

前端會透過 vite.config.js 裡設定的 proxy,把 `/api` 開頭的請求轉發到後端的 http://localhost:3000。

## 目前完成度(MVP 開發中)

- [x] Email 註冊/登入/忘記密碼(含 Resend 寄信整合)
- [x] 記帳(含收入、帳戶餘額自動調整)
- [x] 帳戶管理(含轉帳)
- [x] 行事曆(不含 Google 同步)
- [x] 循環記帳/行程提醒(含每日排程掃描)
- [x] PWA 設定(manifest、Service Worker)
- [x] 首頁儀表板、底部導航列、浮動新增按鈕
- [ ] FCM 推播實際串接(目前是 stub,見 `backend/src/services/fcmService.js`)
- [ ] shadcn/ui 元件庫尚未正式導入(目前用純 Tailwind class 手刻)
- [ ] Google 日曆雙向同步(第二階段)
- [ ] 心情日誌模組(第二、三階段)
- [ ] 付費金流串接(綠界/藍新)

詳細規劃請參考另外提供的《獨立APP_工作目標》文件。
