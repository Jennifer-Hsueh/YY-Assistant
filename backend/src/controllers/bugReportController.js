const { sendEmail } = require('../services/emailService');

// Sends the report straight to the developer's own inbox (BUG_REPORT_EMAIL
// env var) via the existing Resend setup — no database table needed for
// a solo-dev app at this stage.
async function submitBugReport(req, res) {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    const targetEmail = process.env.BUG_REPORT_EMAIL;
    if (!targetEmail) {
      console.warn('[bugReportController] BUG_REPORT_EMAIL not set — cannot deliver report.');
      return res.status(500).json({ error: 'Bug report delivery is not configured' });
    }

    const html = `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <p><strong>回報人:</strong> ${req.user.email}</p>
        <p><strong>標題:</strong> ${title}</p>
        <p><strong>內容:</strong></p>
        <p style="white-space: pre-wrap;">${description}</p>
      </div>
    `;
    await sendEmail({ to: targetEmail, subject: `[故障通報] ${title}`, html });

    return res.json({ message: 'Bug report submitted' });
  } catch (err) {
    console.error('[bugReportController.submitBugReport]', err);
    return res.status(500).json({ error: 'Failed to submit bug report' });
  }
}

module.exports = { submitBugReport };
