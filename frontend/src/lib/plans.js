// 方案說明(與後端 lib/entitlements.js 一致)
export const MONTHLY = { adv_a: 59, adv_b: 59, adv_c: 59, full: 99 };
export const COMMUNITY_ADDON = 10;
export const yearly = (m) => m * 12 - 100;

export const FEATURE_KEYS = ['ledger', 'calendar', 'ledger_recurring', 'calendar_recurring', 'notifications', 'home_image', 'mood', 'export', 'community'];

export const PLAN_KEYS = ['basic', 'adv_a', 'adv_b', 'adv_c', 'full'];
