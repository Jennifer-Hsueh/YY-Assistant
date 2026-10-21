/**
 * YY手帳 寄信中繼站(Google Apps Script)
 * 測試階段用:後端把信件內容送到這裡,再用這個 Google 帳號的 Gmail 寄出。
 *
 * 設定方式:
 * 1. 用要當寄件人的 Gmail 登入 https://script.google.com → 新專案,貼上這整份程式
 * 2. 左側「專案設定」(齒輪) → 指令碼屬性 → 新增屬性:RELAY_KEY = 一組自己產生的長密鑰
 *    (與 Render 後端的 EMAIL_RELAY_KEY 相同;不要貼到對話或程式碼裡)
 * 3. 右上「部署」→「新增部署作業」→ 類型「網頁應用程式」
 *    執行身分:我 / 誰可以存取:所有人 → 部署 → 授權 → 複製「網頁應用程式網址」
 * 4. Render 後端 Environment:EMAIL_RELAY_URL = 網頁應用程式網址、EMAIL_RELAY_KEY = 同一組密鑰
 *
 * 限制:一般 Gmail 每天約可寄給 100 位收件人。正式上線改用自有網域 + Resend 後,
 * 刪除 Render 的 EMAIL_RELAY_URL、EMAIL_RELAY_KEY 即可。
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var key = PropertiesService.getScriptProperties().getProperty('RELAY_KEY');
    if (!key || body.key !== key) return out_({ ok: false, error: 'unauthorized' });
    if (!body.to || !body.subject || !body.html) return out_({ ok: false, error: 'missing fields' });
    if (MailApp.getRemainingDailyQuota() < 1) return out_({ ok: false, error: 'daily quota exceeded' });
    MailApp.sendEmail({
      to: String(body.to),
      subject: String(body.subject),
      htmlBody: String(body.html),
      name: String(body.name || 'YY手帳'),
    });
    return out_({ ok: true, remaining: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

// 在編輯器裡按「執行」測試授權用(會寄一封測試信給自己)
function testSend() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), 'YY手帳 寄信中繼站測試', '設定成功');
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
