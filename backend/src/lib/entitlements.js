// 方案與功能權限(後端唯一的判斷來源,前端只用來顯示)
//
// - 新註冊:註冊日起三個月免費試用,全部功能
// - 試用結束 / 付費到期且過了寬限期:基本功能,記帳或行事曆二擇一(免費,每月可換一次)
//   基本功能沒有循環、社群、通知、本日心情、資料匯出與備份
// - 付費方案到期後有 7 天寬限期,功能照常
// - 管理員、測試員不受限制
// - 沒有權限的資料仍可讀取,只是不能新增或修改

const FEATURES = ['ledger', 'calendar', 'ledger_recurring', 'calendar_recurring', 'notifications', 'mood', 'export', 'community'];

const PLANS = ['basic', 'adv_a', 'adv_b', 'adv_c', 'full'];
const PAID_PLANS = ['adv_a', 'adv_b', 'adv_c', 'full'];
const ADDON_PLANS = ['adv_a', 'adv_b', 'adv_c']; // 可加購社群
const PLAN_FEATURES = {
  adv_a: ['ledger', 'calendar'],
  adv_b: ['ledger', 'ledger_recurring', 'notifications', 'mood', 'export'],
  adv_c: ['calendar', 'calendar_recurring', 'notifications', 'mood', 'export'],
  full: FEATURES,
};

// 月費(元);年繳 = 月費 × 12 − 100
const MONTHLY_PRICE = { adv_a: 69, adv_b: 69, adv_c: 69, full: 109 };
const COMMUNITY_ADDON = 10;
const YEARLY_DISCOUNT = 100;

const TRIAL_MONTHS = 3;
const GRACE_DAYS = 7;
const NOTICE_DAYS = [30, 10, 3, 0];
const STAFF_ROLES = ['admin', 'tester'];

const DAY = 24 * 60 * 60 * 1000;
const taipeiDate = (d = new Date()) => new Date(new Date(d).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
const addDays = (ymd, n) => new Date(new Date(ymd + 'T00:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.round((new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / DAY);
function addMonths(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}

function monthlyPrice(plan, addonCommunity) {
  const base = MONTHLY_PRICE[plan];
  if (!base) return 0;
  return base + (addonCommunity && ADDON_PLANS.includes(plan) ? COMMUNITY_ADDON : 0);
}
// n 個月的價格:滿 12 個月用年繳價
function priceFor(plan, addonCommunity, months) {
  const m = monthlyPrice(plan, addonCommunity);
  const years = Math.floor(months / 12);
  return years * (m * 12 - YEARLY_DISCOUNT) + (months % 12) * m;
}

function trialEnd(user) {
  if (user.trial_ends_at) return user.trial_ends_at;
  if (!user.created_at) return null;
  return addMonths(taipeiDate(user.created_at), TRIAL_MONTHS);
}

// 基本功能每月可換一次(同一個月內已換過就不能再換)
function canChangeChoice(user, today) {
  if (!user.basic_choice || !user.basic_choice_changed_at) return true;
  return taipeiDate(user.basic_choice_changed_at).slice(0, 7) !== today.slice(0, 7);
}

function computeEntitlements(user, today = taipeiDate()) {
  const base = {
    plan: PLANS.includes(user.plan) ? user.plan : 'basic',
    addon_community: !!user.addon_community,
    basic_choice: user.basic_choice || null,
    trial_ends_at: trialEnd(user),
    expires_at: user.plan_expires_at || null,
    grace_ends_at: user.plan_expires_at ? addDays(user.plan_expires_at, GRACE_DAYS) : null,
    can_change_choice: canChangeChoice(user, today),
  };

  if (STAFF_ROLES.includes(user.role)) return { ...base, status: 'staff', features: FEATURES, days_left: null };

  if (base.trial_ends_at && today <= base.trial_ends_at) {
    return { ...base, status: 'trial', features: FEATURES, days_left: daysBetween(today, base.trial_ends_at) };
  }

  if (PAID_PLANS.includes(base.plan)) {
    const exp = base.expires_at;
    const status = !exp || today <= exp ? 'active' : today <= base.grace_ends_at ? 'grace' : null;
    if (status) {
      const features = [...PLAN_FEATURES[base.plan]];
      if (base.addon_community && ADDON_PLANS.includes(base.plan)) features.push('community');
      return { ...base, status, features, days_left: exp ? daysBetween(today, exp) : null };
    }
  }

  // 基本功能(試用結束或付費過期)
  const expired = PAID_PLANS.includes(base.plan) && !!base.expires_at;
  return {
    ...base,
    status: 'basic',
    expired,
    features: base.basic_choice ? [base.basic_choice] : [],
    days_left: null,
  };
}

const has = (ent, feature) => !!ent && ent.features.includes(feature);

module.exports = {
  FEATURES, PLANS, PAID_PLANS, ADDON_PLANS, PLAN_FEATURES, MONTHLY_PRICE, COMMUNITY_ADDON, YEARLY_DISCOUNT,
  TRIAL_MONTHS, GRACE_DAYS, NOTICE_DAYS, STAFF_ROLES,
  taipeiDate, addDays, addMonths, daysBetween, monthlyPrice, priceFor, trialEnd, computeEntitlements, has,
};
