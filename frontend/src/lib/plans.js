// 方案說明(與後端 lib/entitlements.js 一致)
export const MONTHLY = { adv_a: 69, adv_b: 69, adv_c: 69, full: 109 };
export const COMMUNITY_ADDON = 10;
export const yearly = (m) => m * 12 - 100;

export const FEATURE_KEYS = ['ledger', 'calendar', 'ledger_recurring', 'calendar_recurring', 'notifications', 'mood', 'export', 'community'];

export const PLAN_KEYS = ['basic', 'adv_a', 'adv_b', 'adv_c', 'full'];
