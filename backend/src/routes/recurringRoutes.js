const express = require('express');
const supabase = require('../config/supabase');
const { requireAuth, planRequired } = require('../middleware/auth');
const { has } = require('../lib/entitlements');
const {
  listRecurringItems,
  createRecurringItem,
  updateRecurringItem,
  deleteRecurringItem,
} = require('../controllers/recurringController');

const router = express.Router();
router.use(requireAuth);

// 循環記帳 / 循環行程各自屬於不同方案的功能:依項目種類檢查
const featureOf = (kind) => (kind === 'event' ? 'calendar_recurring' : 'ledger_recurring');

async function canWrite(req, res, next) {
  if (!req.ent) return next();
  try {
    let kinds = [];
    if (req.method === 'POST') kinds = [req.body?.kind];
    else {
      const { data } = await supabase.from('yy_recurring_items').select('kind').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
      if (!data) return next(); // 找不到交給 controller 回 404
      kinds = [data.kind];
      if (req.body?.kind) kinds.push(req.body.kind);
    }
    const missing = kinds.map(featureOf).find((f) => !has(req.ent, f));
    return missing ? planRequired(res, missing) : next();
  } catch (err) {
    console.error('[recurringRoutes.canWrite]', err);
    return res.status(500).json({ error: 'Failed to check plan' });
  }
}

router.get('/', listRecurringItems);
router.post('/', canWrite, createRecurringItem);
router.put('/:id', canWrite, updateRecurringItem);
router.delete('/:id', canWrite, deleteRecurringItem);

module.exports = router;
