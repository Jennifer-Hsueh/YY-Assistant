const supabase = require('../config/supabase');
const { sendEmail } = require('./emailService');
const { sendPushToUser } = require('./fcmService');
const E = require('../lib/entitlements');

// 方案到期通知:試用 / 付費方案在到期前 30、10、3 天與當天各通知一次,
// 寬限期結束、試用結束後再通知一次。每則通知寫進 yy_plan_notices(唯一鍵防止重複寄送)。
// 由每天 08:05 的 /cron/recurring 一起執行。

const PLAN_NAME = {
  basic: '基本功能',
  adv_a: '進階 A(記帳+行事曆)',
  adv_b: '進階 B(記帳進階)',
  adv_c: '進階 C(行事曆進階)',
  full: '完整版',
};
const AFTER_DAYS = 3; // 結束後幾天內補發「已結束」通知(避免對很久以前到期的人突然寄信)

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = (ymd) => { const [, m, d] = ymd.split('-'); return `${Number(m)}/${Number(d)}`; };

function planLabel(ent) {
  const name = PLAN_NAME[ent.plan] || ent.plan;
  return ent.addon_community && E.ADDON_PLANS.includes(ent.plan) ? `${name}+社群` : name;
}

function priceTable() {
  const row = (label, m) => `<tr><td style="padding:2px 12px 2px 0">${label}</td><td>${m} 元/月,年繳 ${m * 12 - E.YEARLY_DISCOUNT} 元</td></tr>`;
  return `<table style="font-size:14px;color:#33415C">
    ${row('進階 A、B、C', E.MONTHLY_PRICE.adv_a)}
    ${row('進階 A、B、C + 社群', E.MONTHLY_PRICE.adv_a + E.COMMUNITY_ADDON)}
    ${row('完整版', E.MONTHLY_PRICE.full)}
  </table>`;
}

function contactLine() {
  return process.env.SUPPORT_EMAIL ? `續費或有任何問題,請來信 ${esc(process.env.SUPPORT_EMAIL)}。` : '續費或有任何問題,請與我們聯絡。';
}

// 依情況決定今天要送哪一則(沒有就回 null)
function pickNotice(ent, today) {
  if (ent.status === 'staff') return null;
  const ahead = (kind, ref) => {
    const left = E.daysBetween(today, ref);
    if (left < 0) return null;
    const threshold = [...E.NOTICE_DAYS].sort((a, b) => a - b).find((t) => left <= t);
    return threshold === undefined ? null : { kind, ref, threshold, left };
  };
  if (ent.status === 'trial') return ahead('trial', ent.trial_ends_at);
  if ((ent.status === 'active' || ent.status === 'grace') && ent.expires_at) {
    return ent.status === 'active' ? ahead('expire', ent.expires_at) : null;
  }
  if (ent.status === 'basic') {
    if (ent.expired && ent.grace_ends_at && E.daysBetween(ent.grace_ends_at, today) <= AFTER_DAYS) {
      return { kind: 'ended', ref: ent.expires_at, threshold: -1 };
    }
    if (!ent.expired && ent.trial_ends_at && E.daysBetween(ent.trial_ends_at, today) <= AFTER_DAYS) {
      return { kind: 'trial_ended', ref: ent.trial_ends_at, threshold: -1 };
    }
  }
  return null;
}

function compose(n, ent, user) {
  const name = esc(user.username || '');
  const hi = name ? `${name} 您好:` : '您好:';
  const app = process.env.APP_URL || '';
  const when = n.left === 0 ? '今天' : `${md(n.ref)}(還有 ${n.left} 天)`;
  let subject; let push; let body;
  if (n.kind === 'trial') {
    subject = n.left === 0 ? 'YY手帳 免費試用今天結束' : `YY手帳 免費試用將於 ${md(n.ref)} 結束`;
    push = `免費試用將於${when}結束`;
    body = `<p>YY手帳的三個月免費試用將於 <b>${when}</b> 結束。</p>
      <p>試用結束後會改為「基本功能」:記帳或行事曆二擇一,沒有循環、通知、社群、本日心情與資料匯出備份。您的資料都會保留。</p>
      <p>想繼續使用完整功能,可以選擇進階方案:</p>${priceTable()}`;
  } else if (n.kind === 'expire') {
    subject = n.left === 0 ? `YY手帳 ${planLabel(ent)} 今天到期` : `YY手帳 ${planLabel(ent)} 將於 ${md(n.ref)} 到期`;
    push = `${planLabel(ent)}將於${when}到期`;
    body = `<p>您的方案「${esc(planLabel(ent))}」將於 <b>${when}</b> 到期。</p>
      <p>到期後還有 ${E.GRACE_DAYS} 天寬限期,期間功能照常;寬限期過後會改為基本功能(記帳或行事曆二擇一),資料都會保留。</p>${priceTable()}`;
  } else if (n.kind === 'ended') {
    subject = 'YY手帳 方案已到期,已改為基本功能';
    push = '方案已到期,已改為基本功能';
    body = `<p>您的方案「${esc(planLabel(ent))}」已於 ${md(n.ref)} 到期,寬限期也已結束,目前改為基本功能。</p>
      <p>${ent.basic_choice ? `目前使用的是「${ent.basic_choice === 'ledger' ? '記帳' : '行事曆'}」;另一邊的資料可以查看,但不能新增或修改。` : '請到 App 的「設定」選擇要使用記帳或行事曆。'}</p>
      <p>續費後會立即恢復原本的功能:</p>${priceTable()}`;
  } else {
    subject = 'YY手帳 免費試用已結束';
    push = '免費試用已結束,請到設定選擇記帳或行事曆';
    body = `<p>YY手帳的三個月免費試用已經結束,目前改為基本功能。</p>
      <p>${ent.basic_choice ? `目前使用的是「${ent.basic_choice === 'ledger' ? '記帳' : '行事曆'}」。` : '請到 App 的「設定」選擇要使用記帳或行事曆(每個月可以換一次)。'}您的資料都會保留。</p>
      <p>想使用完整功能,可以選擇進階方案:</p>${priceTable()}`;
  }
  const html = `<div style="font-family:sans-serif;color:#2A2622;line-height:1.6">
    <p>${hi}</p>${body}
    <p>${contactLine()}</p>
    ${app ? `<p><a href="${esc(app)}/settings" style="color:#C1666B">開啟 YY手帳</a></p>` : ''}
  </div>`;
  return { subject, html, push };
}

async function fetchUsers() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('yy_users').select('*').range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

async function runPlanNotices(today = E.taipeiDate()) {
  const users = await fetchUsers();
  let sent = 0;
  for (const user of users) {
    if (user.is_disabled) continue;
    const ent = E.computeEntitlements(user, today);
    const n = pickNotice(ent, today);
    if (!n) continue;
    // 先寫紀錄再寄(唯一鍵):重複執行或同時執行都不會寄兩次
    const { error } = await supabase.from('yy_plan_notices').insert({ user_id: user.id, kind: n.kind, ref_date: n.ref, threshold: n.threshold });
    if (error) {
      if (error.code !== '23505') console.error('[planNotice] record failed', user.id, error.message);
      continue;
    }
    const msg = compose(n, ent, user);
    try {
      await sendEmail({ to: user.email, subject: msg.subject, html: msg.html });
    } catch (err) {
      console.error('[planNotice] email failed', user.id, err.message);
    }
    try {
      await sendPushToUser(user.id, { title: 'YY手帳', body: msg.push, data: { url: '/settings' } });
    } catch (err) {
      console.error('[planNotice] push failed', user.id, err.message);
    }
    sent += 1;
  }
  return { date: today, users: users.length, sent };
}

module.exports = { runPlanNotices, pickNotice, compose, PLAN_NAME };
