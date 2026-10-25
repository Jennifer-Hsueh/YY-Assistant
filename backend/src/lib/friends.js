// 好友關係共用工具(共同行程、共同帳本、小紙條等之後的功能都會用到)
const crypto = require('crypto');
const supabase = require('../config/supabase');

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 去掉容易看錯的 I、L、O、0、1
const CODE_LEN = 8;

function randomCode() {
  const bytes = crypto.randomBytes(CODE_LEN);
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return s;
}

// 使用者輸入的好友碼:去掉空白、連字號,轉大寫
const normalizeCode = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// 兩人之間的關係列(沒有就 null)
async function pairRow(a, b) {
  const { data, error } = await supabase.from('yy_friendships').select('*')
    .or(`and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function areFriends(a, b) {
  const row = await pairRow(a, b);
  return !!row && row.status === 'accepted';
}

// 任一方封鎖對方
async function isBlockedEither(a, b) {
  const { data, error } = await supabase.from('yy_user_blocks').select('blocker_id')
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`);
  if (error) throw error;
  return (data || []).length > 0;
}

// 好友的 id 清單
async function friendIds(userId) {
  const { data, error } = await supabase.from('yy_friendships').select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw error;
  return (data || []).map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
}

module.exports = { CODE_CHARS, CODE_LEN, randomCode, normalizeCode, pairRow, areFriends, isBlockedEither, friendIds };
