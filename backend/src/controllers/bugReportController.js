const supabase = require('../config/supabase');
const { sendEmail } = require('../services/emailService');

// 使用者輸入的內容放進 email 前先跳脫,避免被塞入 HTML
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 故障通報:存進 yy_bug_reports(後台「故障通報」清單),同時寄信給開發者(BUG_REPORT_EMAIL)
async function submitBugReport(req, res) {
  try {
    const title = String(req.body?.title || '').trim().slice(0, 200);
    const description = String(req.body?.description || '').trim().slice(0, 5000);
    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    const { error: insErr } = await supabase.from('yy_bug_reports').insert({
      user_id: req.user.id,
      email: req.user.email || null,
      title,
      description,
      user_agent: String(req.headers['user-agent'] || '').slice(0, 300) || null,
      status: 'new',
    });
    if (insErr) console.error('[bugReportController] save failed', insErr.message);

    const targetEmail = process.env.BUG_REPORT_EMAIL;
    if (!targetEmail) {
      if (insErr) return res.status(500).json({ error: 'Bug report delivery is not configured' });
      return res.json({ message: 'Bug report submitted' });
    }

    const html = `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <p><strong>回報人:</strong> ${esc(req.user.email)}</p>
        <p><strong>標題:</strong> ${esc(title)}</p>
        <p><strong>內容:</strong></p>
        <p style="white-space: pre-wrap;">${esc(description)}</p>
      </div>
    `;
    try {
      await sendEmail({ to: targetEmail, subject: `[故障通報] ${String(title).slice(0, 100)}`, html });
    } catch (mailErr) {
      // 已存進資料庫就算成功
      if (insErr) throw mailErr;
      console.error('[bugReportController] email failed', mailErr.message);
    }

    return res.json({ message: 'Bug report submitted' });
  } catch (err) {
    console.error('[bugReportController.submitBugReport]', err);
    return res.status(500).json({ error: 'Failed to submit bug report' });
  }
}

module.exports = { submitBugReport };
