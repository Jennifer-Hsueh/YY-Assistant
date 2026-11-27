// 社群回應種類
// 晴空與雨天用 12 張小河狸貼圖(前端 public/stickers/<key>.webp);其他版只有「讚」(like)
// 2026-11 以前的 5 種舊回應對應到新的貼圖(資料庫已用 SQL 換過;舊備份還原時也照這張表換)
const MOOD_REACTIONS = ['like', 'surprise', 'confused', 'angry', 'cry', 'hug', 'happy', 'touched', 'excited', 'cheer', 'no', 'thanks'];
const LEGACY_REACTION = { laugh: 'happy', understand: 'touched', approve: 'like' };
const normalizeReaction = (type) => LEGACY_REACTION[type] || type;

module.exports = { MOOD_REACTIONS, LEGACY_REACTION, normalizeReaction };
