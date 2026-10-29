// 匯款回報(網頁版「我的方案」):使用者填匯款資料 → 待核對 → 管理員在後台核對後開通
const supabase = require('../config/supabase');
const E = require('../lib/entitlements');
const proofs = require('../services/paymentProofs');
const { sendPushToUser } = require('../services/fcmService');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PENDING = 3;
const COLS = 'id, paid_on, amount, account_last5, plan, addon_community, months, note, status, reject_reason, reviewed_at, created_at, proof_key';

function fail(res, where, err, msg) {
  console.error(`[paymentReportController.${where}]`, err);
  return res.status(500).json({ error: msg });
}

const pub = (r) => { const { proof_key, ...rest } = r; return { ...rest, has_proof: !!proof_key }; };

// GET /payment-reports:自己的回報紀錄(最近 20 筆)
async function list(req, res) {
  try {
    const { data, error } = await supabase.from('yy_payment_reports').select(COLS).eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return res.json({ reports: (data || []).map(pub) });
  } catch (err) {
    return fail(res, 'list', err, '讀取匯款回報失敗');
  }
}

// POST /payment-reports/proof { image }:先上傳轉帳截圖,回傳 key
async function uploadProof(req, res) {
  try {
    const key = await proofs.uploadProof(req.user.id, req.body?.image);
    return res.status(201).json({ key });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return fail(res, 'uploadProof', err, '上傳失敗');
  }
}

// POST /payment-reports { paid_on, amount, account_last5, plan, addon_community, months, proof_key?, note? }
async function create(req, res) {
  try {
    const b = req.body || {};
    if (!DATE_RE.test(b.paid_on || '') || b.paid_on > E.taipeiDate()) return res.status(400).json({ error: '匯款日期不正確' });
    const amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return res.status(400).json({ error: '金額不正確' });
    const last5 = String(b.account_last5 || '').trim();
    if (!/^\d{5}$/.test(last5)) return res.status(400).json({ error: '請輸入帳號末 5 碼' });
    if (!E.PAID_PLANS.includes(b.plan)) return res.status(400).json({ error: '請選擇方案' });
    const months = parseInt(b.months, 10);
    if (![1, 12].includes(months)) return res.status(400).json({ error: '請選擇月繳或年繳' });
    if (b.proof_key && !proofs.validKey(req.user.id, b.proof_key)) return res.status(400).json({ error: '照片格式不正確' });
    // 使用條款第 8 條:數位服務經同意後不適用七日猶豫期,回報時須勾選同意
    if (b.agree_refund_terms !== true) return res.status(400).json({ error: '請先閱讀並同意退費規則' });
    const { count, error: cErr } = await supabase.from('yy_payment_reports').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('status', 'pending');
    if (cErr) throw cErr;
    if ((count || 0) >= MAX_PENDING) return res.status(400).json({ error: `待核對的回報最多 ${MAX_PENDING} 筆，請等核對完成` });
    const { data: me } = await supabase.from('yy_users').select('email').eq('id', req.user.id).maybeSingle();
    const { data, error } = await supabase.from('yy_payment_reports').insert({
      user_id: req.user.id,
      user_email: me?.email || null,
      paid_on: b.paid_on,
      amount,
      account_last5: last5,
      plan: b.plan,
      addon_community: !!b.addon_community && E.ADDON_PLANS.includes(b.plan),
      months,
      proof_key: b.proof_key || null,
      note: String(b.note || '').trim().slice(0, 200) || null,
      status: 'pending',
      refund_terms_agreed_at: new Date().toISOString(),
    }).select(COLS).single();
    if (error) throw error;
    // 通知管理員有新的匯款回報
    const { data: admins } = await supabase.from('yy_users').select('id').eq('role', 'admin');
    for (const a of admins || []) {
      sendPushToUser(a.id, { title: '💰 新的匯款回報', body: `${me?.email || ''} 回報了一筆 ${amount} 元的匯款，請到後台核對` }).catch(() => {});
    }
    return res.status(201).json({ report: pub(data) });
  } catch (err) {
    return fail(res, 'create', err, '送出失敗');
  }
}

// DELETE /payment-reports/:id:還沒核對的可以取消
async function remove(req, res) {
  try {
    const { data: r, error } = await supabase.from('yy_payment_reports').select('id, status, proof_key').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (error) throw error;
    if (!r) return res.status(404).json({ error: '找不到這筆回報' });
    if (r.status !== 'pending') return res.status(400).json({ error: '已核對的回報不能取消' });
    const { error: dErr } = await supabase.from('yy_payment_reports').delete().eq('id', r.id);
    if (dErr) throw dErr;
    await proofs.removeProof(r.proof_key);
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'remove', err, '取消失敗');
  }
}

module.exports = { list, uploadProof, create, remove };
