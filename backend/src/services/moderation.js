const supabase = require('../config/supabase');

// 違規處理(使用條款第 12 條):紀錄、社群暫停、以個人公告通知
const ACTIONS = ['hide_post', 'restore_post', 'warn', 'suspend', 'lift', 'disable', 'enable'];
const SUSPEND_DAYS = [7, 30];

const fmtDate = (iso) => new Date(iso).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric' });
const appealText = () => {
  const mail = process.env.SUPPORT_EMAIL;
  return mail
    ? `如有異議，請於通知後 14 天內來信 ${mail} 說明理由（使用條款第 13 條）。`
    : '如有異議，請於通知後 14 天內依使用條款第 13 條提出申訴。';
};

// 目前仍在暫停中 → 回傳到期時間(ISO);否則 null
async function suspendedUntil(userId) {
  const { data } = await supabase.from('yy_users').select('community_suspended_until').eq('id', userId).maybeSingle();
  const until = data?.community_suspended_until;
  return until && new Date(until).getTime() > Date.now() ? until : null;
}

function suspendedError(res, until) {
  return res.status(403).json({
    error: `社群功能暫停到 ${fmtDate(until)}，期間只能發表僅自己可見的文章`,
    code: 'COMMUNITY_SUSPENDED',
    until,
  });
}

async function logAction(row) {
  const { error } = await supabase.from('yy_moderation_actions').insert(row);
  if (error) console.error('[moderation.logAction]', error);
}

// 只有該使用者看得到的重要公告
async function notifyUser(userId, title, content) {
  const { error } = await supabase.from('yy_announcements').insert({
    title, content, is_important: true, target_user_id: userId, published_at: new Date().toISOString(),
  });
  if (error) console.error('[moderation.notifyUser]', error);
}

module.exports = { ACTIONS, SUSPEND_DAYS, fmtDate, appealText, suspendedUntil, suspendedError, logAction, notifyUser };
