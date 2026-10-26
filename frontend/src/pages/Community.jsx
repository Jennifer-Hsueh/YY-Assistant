import { useEffect, useState } from 'react';
import { usePlan } from '../context/PlanContext';
import { askUpgrade } from '../components/PlanNotice';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, MessageCircle, ThumbsUp, Users } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api';
import Friends from './Friends';
import { helplineText } from '../lib/helplines';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { PostImages, ImagePicker } from '../components/PostImages';

const TABS = [
  { key: 'mood', emoji: '🌦️' },
  { key: 'finance', emoji: '🐷' },
  { key: 'wish', emoji: '✨' },
  { key: 'mine', emoji: '🔒' },
  { key: 'friends', emoji: '🤝' },
];
const BOARD_EMOJI = { mood: '🌦️', finance: '🐷', wish: '✨' };
const MOODS = [
  { key: 'sunny', emoji: '☀️' },
  { key: 'cloudy', emoji: '⛅' },
  { key: 'rainy', emoji: '🌧️' },
  { key: 'storm', emoji: '⛈️' },
  { key: 'rainbow', emoji: '🌈' },
];
const MOOD_EMOJI = Object.fromEntries(MOODS.map((m) => [m.key, m.emoji]));
// 心情回應:小河狸圖(public/reactions/*.webp)
const MOOD_REACTIONS = ['hug', 'cheer', 'understand', 'laugh', 'approve'].map((key) => ({ key, src: `/reactions/${key}.webp` }));
const WISH_STATUSES = ['considering', 'planned', 'done'];
// 公開範圍三選一 → { visibility, anonymous }
const SCOPES = [
  { key: 'private', label: 'cm_private', value: { visibility: 'private', anonymous: false } },
  { key: 'anon', label: 'cm_public_anon', value: { visibility: 'public', anonymous: true } },
  { key: 'friends', label: 'cm_friends_only', value: { visibility: 'friends', anonymous: false } },
  { key: 'named', label: 'cm_public_named', value: { visibility: 'public', anonymous: false } },
];
// 檢舉原因(對應使用條款第 10 條);存進資料庫一律用中文,方便後台閱讀
const REPORT_REASONS = [
  { key: 'ad', zh: '廣告／引流' },
  { key: 'scam', zh: '詐騙或要求轉帳' },
  { key: 'harass', zh: '騷擾、霸凌或仇恨言論' },
  { key: 'sexual', zh: '色情或暴力內容' },
  { key: 'privacy', zh: '公開他人個人資料' },
  { key: 'selfharm', zh: '鼓勵自我傷害或危險行為' },
  { key: 'other', zh: '其他' },
];
const scopeOf = (p) => (p.visibility === 'private' ? 'private' : p.visibility === 'friends' ? 'friends' : p.anonymous ? 'anon' : 'named');

const emptyDraft = { board: 'mood', mood: null, title: '', content: '', scope: 'private', hide: { mode: 'none', ids: [] }, images: [] };
// 隱藏好友:公開文章可以「全部好友」或「選擇好友」;僅好友可見只能選擇好友;僅自己不需要
const hideModes = (scopeKey) => (scopeKey === 'private' ? [] : scopeKey === 'friends' ? ['none', 'pick'] : ['none', 'all', 'pick']);
const hideOf = (p) => (p.hide_friends ? { mode: 'all', ids: [] } : p.hidden_from?.length ? { mode: 'pick', ids: p.hidden_from } : { mode: 'none', ids: [] });
const hideBody = (scopeKey, h) => {
  const modes = hideModes(scopeKey);
  const mode = modes.includes(h.mode) ? h.mode : 'none';
  return { hide_friends: mode === 'all', hidden_from: mode === 'pick' ? h.ids : [] };
};

// 好友名單只抓一次
let friendsCache = null;
function useFriendList(enabled) {
  const [list, setList] = useState(friendsCache);
  useEffect(() => {
    if (!enabled || friendsCache) return;
    api.getFriends().then(({ friends }) => { friendsCache = friends; setList(friends); }).catch(() => setList([]));
  }, [enabled]);
  return list;
}

// 隱藏好友:不隱藏/全部好友/選擇好友(勾選要隱藏的人)
function HidePicker({ t, scopeKey, value, onChange }) {
  const modes = hideModes(scopeKey);
  const friends = useFriendList(value.mode === 'pick');
  if (!modes.length) return null;
  const mode = modes.includes(value.mode) ? value.mode : 'none';
  const toggle = (id) => onChange({ mode: 'pick', ids: value.ids.includes(id) ? value.ids.filter((x) => x !== id) : [...value.ids, id] });
  return (
    <div className="mt-2 w-full">
      <p className="mb-1.5 text-xs text-muted-foreground">{t('cm_hide_title')}</p>
      <div className="flex flex-wrap gap-1.5">
        {modes.map((m) => (
          <button key={m} type="button" onClick={() => onChange({ mode: m, ids: value.ids })} className={pillClass(mode === m)}>{t(`cm_hide_${m}`)}</button>
        ))}
      </div>
      {mode === 'pick' && (
        <div className="mt-2 rounded-md border border-border p-2">
          {!friends ? <p className="text-xs text-muted-foreground">{t('loading')}</p> : friends.length === 0 ? <p className="text-xs text-muted-foreground">{t('cm_hide_no_friends')}</p> : (
            <div className="flex flex-wrap gap-1.5">
              {friends.map((f) => (
                <button key={f.id} type="button" onClick={() => toggle(f.id)} className={`rounded-full border px-2.5 py-0.5 text-xs ${value.ids.includes(f.id) ? 'border-foreground bg-muted text-foreground line-through' : 'border-border text-muted-foreground'}`}>
                  {f.name || '—'}
                </button>
              ))}
            </div>
          )}
          {friends?.length > 0 && <p className="mt-1.5 text-[11px] text-muted-foreground">{t('cm_hide_pick_hint').replace('{n}', value.ids.length)}</p>}
        </div>
      )}
    </div>
  );
}

function pillClass(active) {
  return `rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${active ? 'border-foreground bg-muted font-medium text-foreground' : 'border-border text-muted-foreground hover:bg-muted/60'}`;
}

function relativeTime(t, iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 60000;
  if (diff < 1) return t('cm_just_now');
  if (diff < 60) return `${Math.floor(diff)}${t('cm_minutes_ago')}`;
  if (d.toDateString() === now.toDateString()) return `${Math.floor(diff / 60)}${t('cm_hours_ago')}`;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return t('cm_yesterday');
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}/${md}`;
}

export default function Community() {
  const { t, language } = useLanguage();
  const [country, setCountry] = useState(null);
  // 版別由網址決定(/community/mood 等),左側選單與頁內版別列共用
  const { board } = useParams();
  const navigate = useNavigate();
  // /community(沒有版名)先顯示社群使用規則,點版名後才顯示內容
  const tab = TABS.some((x) => x.key === board) ? board : null;
  const [friendView, setFriendView] = useState(null);
  useEffect(() => { setFriendView(null); }, [tab]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [mineFilter, setMineFilter] = useState('all');
  // 板上的「全部／好友」篩選;好友篩選可以隱藏特定好友
  const [feedScope, setFeedScope] = useState('all');
  const [stats, setStats] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [composeOpen, setComposeOpen] = useState(false);
  const { can } = usePlan();
  const member = can('community');
  const [error, setError] = useState('');
  const [suspendedUntil, setSuspendedUntil] = useState(null);
  // 社群暫停中:顯示後端給的說明;其他錯誤顯示一般訊息
  const errText = (err) => (err?.code === 'COMMUNITY_SUSPENDED' ? err.message : t('cm_error'));
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.getProfile().then(({ profile }) => {
      setIsAdmin(profile?.role === 'admin');
      setCountry(profile?.country || null);
      const until = profile?.community_suspended_until;
      setSuspendedUntil(until && new Date(until) > new Date() ? until : null);
    }).catch(() => {});
  }, []);

  function refreshStats() {
    api.getCommunityStats().then(({ stats }) => setStats(stats)).catch(() => {});
  }

  async function load({ append = false } = {}) {
    if (!tab || tab === 'friends') return;
    if (!append) setLoading(true);
    setError('');
    try {
      const params = { board: tab };
      if (tab === 'mine' && mineFilter !== 'all') params.visibility = mineFilter;
      if (tab !== 'mine' && feedScope === 'friends') params.scope = 'friends';
      if (append && posts.length) params.before = posts[posts.length - 1].created_at;
      const { posts: rows, has_more } = await api.listPosts(params);
      setPosts((prev) => (append ? [...prev, ...rows] : rows));
      setHasMore(has_more ?? rows.length === 30);
      if (tab === 'mine') refreshStats();
    } catch (err) {
      console.error(err);
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tab, mineFilter, feedScope]);

  useEffect(() => {
    if (tab && tab !== 'mine' && tab !== 'friends') setDraft((d) => ({ ...d, board: tab }));
  }, [tab]);

  function switchTab(key) {
    navigate(`/community/${key}`);
  }

  const draftBoard = tab === 'mine' ? draft.board : tab;

  async function publish(e) {
    if (!member) { e.preventDefault(); askUpgrade('community'); return; }
    e.preventDefault();
    if (!draft.content.trim()) return;
    setPosting(true);
    setError('');
    try {
      const scope = SCOPES.find((s) => s.key === draft.scope).value;
      const { post } = await api.createPost({
        board: draftBoard,
        mood: draftBoard === 'mood' ? draft.mood : null,
        title: draftBoard === 'mood' ? null : draft.title,
        content: draft.content,
        images: draft.images.map((i) => i.key),
        ...scope,
        ...hideBody(draft.scope, draft.hide),
      });
      setDraft({ ...emptyDraft, board: draftBoard, scope: draft.scope, hide: draft.hide });
      setComposeOpen(false);
      // 公開文章出現在目前的板上;私人文章只出現在「我的」
      const showsHere = tab === 'mine'
        ? mineFilter === 'all' || mineFilter === post.visibility
        : post.visibility === 'public' && post.board === tab;
      if (showsHere) setPosts((prev) => [post, ...prev]);
      if (tab === 'mine') refreshStats();
    } catch (err) {
      console.error(err);
      setError(errText(err));
    } finally {
      setPosting(false);
    }
  }

  function replacePost(updated) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    if (tab === 'mine') refreshStats();
  }

  function removePost(id) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    if (tab === 'mine') refreshStats();
  }

  const tabBar = (
    <div className="mb-3 flex overflow-x-auto rounded-lg border border-border bg-card p-1 text-sm shadow-sm">
      {TABS.map(({ key, emoji }) => (
        <button
          key={key}
          type="button"
          onClick={() => switchTab(key)}
          className={`flex-1 whitespace-nowrap rounded-md px-1 py-1.5 text-[13px] transition-colors md:px-2.5 md:text-sm ${tab === key ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
        >
          <span className="hidden md:inline">{emoji} </span>{key === 'mine' ? t('cm_mine') : key === 'friends' ? t('cm_friends') : t(`cm_board_${key}`)}
        </button>
      ))}
    </div>
  );

  const boardIntro = tab !== 'mine' && (
    <Card className="mb-3">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="text-3xl leading-none">{BOARD_EMOJI[tab]}</span>
        <div>
          <p className="text-sm font-semibold">{t(`cm_board_${tab}`)}</p>
          <p className="text-xs text-muted-foreground">{t(`cm_intro_${tab}`)}</p>
        </div>
      </CardContent>
    </Card>
  );

  const composeCard = (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">{draftBoard === 'mood' ? t('cm_compose_mood') : t('cm_compose')}</p>
        <form onSubmit={publish} className="space-y-3">
          {tab === 'mine' && (
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">{t('cm_board')}</p>
              <div className="flex flex-wrap gap-1.5">
                {['mood', 'finance', 'wish'].map((b) => (
                  <button key={b} type="button" onClick={() => setDraft({ ...draft, board: b })} className={pillClass(draft.board === b)}>
                    {BOARD_EMOJI[b]} {t(`cm_board_${b}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {draftBoard === 'mood' ? (
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">{t('cm_weather')}</p>
              <div className="flex gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    aria-label={t(`cm_mood_${m.key}`)}
                    onClick={() => setDraft({ ...draft, mood: draft.mood === m.key ? null : m.key })}
                    className={`${pillClass(draft.mood === m.key)} text-lg leading-none`}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Input placeholder={t('cm_title')} value={draft.title} maxLength={80} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          )}
          <textarea
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            placeholder={t('cm_content_placeholder')}
            maxLength={2000}
            rows={5}
            required
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
          <ImagePicker
            value={draft.images}
            onChange={(fn) => setDraft((d) => ({ ...d, images: typeof fn === 'function' ? fn(d.images) : fn }))}
            onBusy={setUploading}
            t={t}
          />
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">{t('cm_visibility')}</p>
            <div className="flex flex-wrap gap-1.5">
              {SCOPES.map((s) => (
                <button key={s.key} type="button" onClick={() => setDraft({ ...draft, scope: s.key })} className={pillClass(draft.scope === s.key)}>
                  {s.key === 'private' && <Lock className="mr-1 inline h-3 w-3 align-[-1px]" />}
                  {t(s.label)}
                </button>
              ))}
            </div>
            <HidePicker t={t} scopeKey={draft.scope} value={draft.hide} onChange={(hide) => setDraft((d) => ({ ...d, hide }))} />
          </div>
          <Button type="submit" className="w-full" disabled={posting || uploading || !draft.content.trim()}>{t('cm_publish')}</Button>
        </form>
        {/* 安心專線:依個人資訊的國別顯示,未設定時顯示台灣;國別沒有專線則整列不顯示 */}
        {draftBoard === 'mood' && helplineText(country, language) && (
          <p className="border-t border-dashed border-border pt-3 text-xs text-muted-foreground">{t('cm_help')} {helplineText(country, language)}</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-40 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-accounts)', '--ring': 'var(--module-accounts)' }}>
      <h1 className="page-title-row page-title mb-4 flex items-center gap-2 text-lg font-semibold">
        <Users className="h-5 w-5 md:hidden" style={{ color: 'var(--module-accounts)' }} />
        {t('nav_community')}
      </h1>

      {/* 版別列:手機與網頁都橫跨整個內容寬度 */}
      {tabBar}
      {/* 手機版順序:版別 → 版名介紹 → 寫文章 → 文章列表 */}
      {!tab ? (
        <Card>
          <CardContent className="p-5">
            <p className="mb-2 text-base font-semibold">📋 {t('cm_rules_title')}</p>
            <p className="mb-3 text-sm text-muted-foreground">{t('cm_rules_intro')}</p>
            <ol className="mb-4 space-y-2 text-sm">
              {['cm_rule_1', 'cm_rule_2', 'cm_rule_3'].map((k, i) => (
                <li key={k} className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white" style={{ background: 'var(--module-accounts)' }}>{i + 1}</span>
                  <span>{t(k)}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">{t('cm_rules_outro')}</p>
          </CardContent>
        </Card>
      ) : tab === 'friends' ? (
        friendView
          ? <FriendPosts friend={friendView} t={t} isAdmin={isAdmin} onBack={() => setFriendView(null)} />
          : <Friends onOpen={setFriendView} />
      ) : (<>
      <div className="md:hidden">{boardIntro}</div>

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-6">
        <div className="md:sticky md:top-6 md:order-2">
          {tab === 'mine' && stats && (
            <Card className="mb-3">
              <CardContent className="p-4">
                <p className="mb-3 text-sm font-medium">{t('cm_stats')}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    [stats.private, 'cm_stat_private'],
                    [stats.public, 'cm_stat_public'],
                    [stats.reactions_received, 'cm_stat_reactions'],
                  ].map(([n, k]) => (
                    <div key={k} className="rounded-lg border border-border px-2 py-2">
                      <p className="font-amount text-xl font-semibold">{n}</p>
                      <p className="text-xs text-muted-foreground">{t(k)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-1.5">
                  {[['all', 'cm_filter_all'], ['private', 'cm_private'], ['friends', 'cm_friends_only'], ['public', 'cm_stat_public']].map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setMineFilter(k)} className={pillClass(mineFilter === k)}>{t(label)}</button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 手機版:點「寫文章」才展開;桌機版一直顯示 */}
          {/* 方案沒有社群功能:只能瀏覽,發文、回應、留言時跳出提示 */}
          {<>
          <button
            type="button"
            onClick={() => (member ? setComposeOpen((v) => !v) : askUpgrade('community'))}
            className="mb-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm md:hidden"
          >
            ✏️ {draftBoard === 'mood' ? t('cm_compose_mood') : t('cm_compose')}
          </button>
          <div className={`mb-4 ${composeOpen ? '' : 'hidden'} md:block`}>{composeCard}</div>
          </>}
        </div>

        <div className="md:order-1">
          <div className="hidden md:block">{boardIntro}</div>

          {suspendedUntil && (
            <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              社群功能暫停到 {new Date(suspendedUntil).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}，期間只能發表僅自己可見的文章
            </p>
          )}
          {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

          {tab !== 'mine' && (
            <div className="mb-3 flex items-center gap-1.5">
              {[['all', 'cm_feed_all'], ['friends', 'cm_feed_friends']].map(([k, label]) => (
                <button key={k} type="button" onClick={() => setFeedScope(k)} className={pillClass(feedScope === k)}>{t(label)}</button>
              ))}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : posts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('cm_empty')}</p>
          ) : (
            <div className="space-y-3">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} t={t} inMine={tab === 'mine'} isAdmin={isAdmin} onChange={replacePost} onRemove={removePost} onError={(err) => setError(errText(err))} />
              ))}
              {hasMore && (
                <button type="button" onClick={() => load({ append: true })} className="w-full py-2 text-sm text-muted-foreground underline">
                  {t('cm_load_more')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      </>)}
    </div>
  );
}

// 某位好友的文章(僅好友可見+具名公開;對我隱藏的看不到)
function FriendPosts({ friend, t, isAdmin, onBack }) {
  const [posts, setPosts] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  async function load(append = false) {
    try {
      const params = { board: 'friend', user_id: friend.id };
      if (append && posts?.length) params.before = posts[posts.length - 1].created_at;
      const { posts: rows, has_more } = await api.listPosts(params);
      setPosts((prev) => (append ? [...(prev || []), ...rows] : rows));
      setHasMore(!!has_more);
    } catch (err) {
      console.error(err);
      setError(t('cm_error'));
      setPosts((p) => p || []);
    }
  }
  useEffect(() => { load(); }, [friend.id]);
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={onBack} className="text-sm text-muted-foreground underline">← {t('cm_back_friends')}</button>
        <p className="ml-auto text-sm font-medium">{t('cm_friend_posts').replace('{name}', friend.name || '—')}</p>
      </div>
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      {!posts ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : posts.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('cm_friend_posts_empty')}</p>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} t={t} inMine={false} isAdmin={isAdmin}
              onChange={(np) => setPosts((list) => list.map((x) => (x.id === np.id ? np : x)))}
              onRemove={(id) => setPosts((list) => list.filter((x) => x.id !== id))}
              onError={() => setError(t('cm_error'))} />
          ))}
          {hasMore && <button type="button" onClick={() => load(true)} className="w-full py-2 text-sm text-muted-foreground underline">{t('cm_load_more')}</button>}
        </div>
      )}
    </div>
  );
}

function PostCard({ post, t, inMine, isAdmin, onChange, onRemove, onError }) {
  const member = usePlan().can('community');
  const [confirm, setConfirm] = useState(null); // 'delete' | 'report' | 'reported'
  const [reportReason, setReportReason] = useState(null);
  const [reportDetail, setReportDetail] = useState('');
  const [scopeOpen, setScopeOpen] = useState(false);
  const [hideDraft, setHideDraft] = useState(null);
  // 編輯自己的文章:標題、內容、照片
  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const isPrivate = post.visibility === 'private';
  const [commentsOpen, setCommentsOpen] = useState(isPrivate && post.comment_count > 0);
  const isMoodPublic = post.board === 'mood' && !isPrivate;
  // 私人文章:只有自己能「留言給自己」;晴空與雨天的公開文章:只有回應、不開放留言
  const canComment = isPrivate ? post.is_mine : post.board !== 'mood';

  const displayName = post.author_name
    ? post.author_name
    : post.board === 'mood'
      ? `${t('cm_anon_prefix')}${t(`cm_mood_${post.mood || 'cloudy'}`)}`
      : t('cm_anon');

  async function run(fn) {
    try { await fn(); } catch (err) { console.error(err); onError(err); }
  }

  const react = (type) => (!member ? askUpgrade('community') : run(async () => { const { post: p } = await api.reactToPost(post.id, type); onChange(p); }));
  const changeScope = (key, extra = {}) => run(async () => {
    const { post: p } = await api.updatePost(post.id, { ...SCOPES.find((s) => s.key === key).value, ...extra });
    setScopeOpen(false);
    setHideDraft(null);
    // 在板上改成「僅自己」= 從板上收回
    if (inMine || p.visibility === 'public') onChange(p); else onRemove(post.id);
  });
  const remove = () => run(async () => { await api.deletePost(post.id); onRemove(post.id); });
  function startEdit() {
    if (!member) { askUpgrade('community'); return; }
    setEditing({ title: post.title || '', content: post.content, images: post.images || [] });
    setScopeOpen(false);
    setConfirm(null);
  }
  async function saveEdit(e) {
    e.preventDefault();
    if (!editing.content.trim()) return;
    setSavingEdit(true);
    try {
      const { post: p } = await api.updatePost(post.id, {
        ...(post.board !== 'mood' ? { title: editing.title } : {}),
        content: editing.content,
        images: editing.images.map((i) => i.key),
      });
      onChange(p);
      setEditing(null);
    } catch (err) {
      console.error(err);
      onError(err);
    } finally {
      setSavingEdit(false);
    }
  }
  const report = () => run(async () => {
    const r = REPORT_REASONS.find((x) => x.key === reportReason);
    const detail = reportDetail.trim();
    await api.reportPost(post.id, `${r.zh}${detail ? `:${detail}` : ''}`.slice(0, 200));
    setConfirm('reported');
  });
  const setStatus = (s) => run(async () => { const { post: p } = await api.setWishStatus(post.id, s || null); onChange(p); });

  return (
    <Card>
      <CardContent className="p-4 text-sm">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {!inMine && post.board === 'mood' && post.mood && <span>{MOOD_EMOJI[post.mood]}</span>}
            {inMine ? (
              <>
                <span>{post.mood ? MOOD_EMOJI[post.mood] : BOARD_EMOJI[post.board]} {t(`cm_board_${post.board}`)}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  {isPrivate && <Lock className="h-3 w-3" />}
                  {t(SCOPES.find((s) => s.key === scopeOf(post)).label)}
                </span>
                {post.is_mine && (post.hide_friends || post.hidden_from?.length > 0) && (
                  <span>· {post.hide_friends ? t('cm_hidden_all') : t('cm_hidden_n').replace('{n}', post.hidden_from.length)}</span>
                )}
              </>
            ) : (
              <span>{displayName}</span>
            )}
          </span>
          <span className="shrink-0">{relativeTime(t, post.created_at)}{post.edited_at && `・${t('cm_edited')}`}</span>
        </div>

        {editing ? (
          <form onSubmit={saveEdit} className="space-y-2">
            {post.board !== 'mood' && (
              <Input placeholder={t('cm_title')} value={editing.title} maxLength={80} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            )}
            <textarea
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              maxLength={2000}
              rows={5}
              required
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
            <ImagePicker
              value={editing.images}
              onChange={(fn) => setEditing((d) => ({ ...d, images: typeof fn === 'function' ? fn(d.images) : fn }))}
              onBusy={setEditUploading}
              t={t}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="flex-1" disabled={savingEdit || editUploading || !editing.content.trim()}>{t('cm_save')}</Button>
              <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setEditing(null)}>{t('cancel')}</Button>
            </div>
          </form>
        ) : (
          <>
            {post.title && <p className="mb-1 font-semibold">{post.title}</p>}
            <p className="whitespace-pre-wrap leading-relaxed">{post.content}</p>
            <PostImages images={post.images} />
          </>
        )}
        {post.hidden && <p className="mt-2 text-xs text-muted-foreground">{t('cm_post_hidden')}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isMoodPublic && MOOD_REACTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => react(r.key)}
              title={t(`cm_r_${r.key}`)}
              className={`inline-flex items-center gap-1 rounded-full border py-0.5 pl-1 pr-2.5 text-xs transition-colors ${post.my_reaction === r.key ? 'border-foreground bg-muted text-foreground' : 'border-border text-muted-foreground hover:bg-muted/60'}`}
            >
              <img src={r.src} alt="" className="h-6 w-6" /> {t(`cm_r_${r.key}`)} {post.reactions[r.key] || 0}
            </button>
          ))}
          {!isPrivate && post.board !== 'mood' && (
            <button
              type="button"
              onClick={() => react('like')}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${post.my_reaction === 'like' ? 'border-foreground bg-muted text-foreground' : 'border-border text-muted-foreground hover:bg-muted/60'}`}
            >
              <ThumbsUp className="h-3 w-3" /> {post.reactions.like || 0}
            </button>
          )}
          {canComment && (
            <button
              type="button"
              onClick={() => setCommentsOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/60"
            >
              <MessageCircle className="h-3 w-3" /> {isPrivate ? t('cm_self_note') : post.comment_count}
            </button>
          )}
          {post.board === 'wish' && !isPrivate && (
            isAdmin ? (
              <select
                value={post.wish_status || ''}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
              >
                <option value="">{t('cm_status_none')}</option>
                {WISH_STATUSES.map((s) => <option key={s} value={s}>{t(`cm_status_${s}`)}</option>)}
              </select>
            ) : post.wish_status ? (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{t(`cm_status_${post.wish_status}`)}</span>
            ) : null
          )}

          <span className="ml-auto flex gap-3 text-xs text-muted-foreground">
            {post.is_mine && !editing && (
              <button type="button" onClick={startEdit} className="underline">{t('cm_edit')}</button>
            )}
            {post.is_mine && (
              <button type="button" onClick={() => setScopeOpen((v) => !v)} className="underline">{t('cm_change_visibility')}</button>
            )}
            {(post.is_mine || isAdmin) && (
              <button type="button" onClick={() => setConfirm('delete')} className="underline">{t('cm_delete')}</button>
            )}
            {!post.is_mine && confirm !== 'reported' && (
              <button type="button" onClick={() => (member ? setConfirm('report') : askUpgrade('community'))} className="underline">{t('cm_report')}</button>
            )}
          </span>
        </div>

        {scopeOpen && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SCOPES.map((s) => (
              <button key={s.key} type="button" onClick={() => changeScope(s.key)} className={pillClass(scopeOf(post) === s.key)}>
                {t(s.label)}
              </button>
            ))}
            {hideModes(scopeOf(post)).length > 0 && (
              <>
                <HidePicker t={t} scopeKey={scopeOf(post)} value={hideDraft || hideOf(post)} onChange={setHideDraft} />
                {hideDraft && (
                  <Button size="sm" className="mt-1" onClick={() => changeScope(scopeOf(post), hideBody(scopeOf(post), hideDraft))}>{t('cm_save')}</Button>
                )}
              </>
            )}
          </div>
        )}

        {confirm === 'report' && (
          <div className="mt-3 space-y-2 rounded-md border border-border p-3 text-xs">
            <p className="font-medium">{t('cm_report_reason')}</p>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_REASONS.map((r) => (
                <button key={r.key} type="button" onClick={() => setReportReason(r.key)} className={pillClass(reportReason === r.key)}>
                  {t(`cm_reason_${r.key}`)}
                </button>
              ))}
            </div>
            <textarea
              value={reportDetail}
              onChange={(e) => setReportDetail(e.target.value)}
              maxLength={150}
              rows={2}
              placeholder={reportReason === 'other' ? t('cm_report_detail_required') : t('cm_report_detail')}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="flex-1"
                disabled={!reportReason || (reportReason === 'other' && !reportDetail.trim())}
                onClick={report}
              >
                {t('cm_report_submit')}
              </Button>
              <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => { setConfirm(null); setReportReason(null); setReportDetail(''); }}>{t('cancel')}</Button>
            </div>
          </div>
        )}
        {confirm === 'delete' && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs">
            <span>{confirm === 'delete' ? t('cm_confirm_delete') : t('cm_confirm_report')}</span>
            <span className="flex gap-2">
              <Button type="button" size="sm" variant="destructive" onClick={confirm === 'delete' ? remove : report}>
                {confirm === 'delete' ? t('cm_delete') : t('cm_report')}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setConfirm(null)}>{t('cancel')}</Button>
            </span>
          </div>
        )}
        {confirm === 'reported' && <p className="mt-2 text-xs text-muted-foreground">{t('cm_reported')}</p>}

        {commentsOpen && canComment && (
          <Comments post={post} t={t} isAdmin={isAdmin} onCountChange={(n) => onChange({ ...post, comment_count: n })} onError={onError} />
        )}
      </CardContent>
    </Card>
  );
}

function Comments({ post, t, isAdmin, onCountChange, onError }) {
  const member = usePlan().can('community');
  const [comments, setComments] = useState(null);
  const [text, setText] = useState('');
  const isPrivate = post.visibility === 'private';

  useEffect(() => {
    api.listComments(post.id)
      .then(({ comments }) => setComments(comments))
      .catch((err) => { console.error(err); setComments([]); });
  }, [post.id]);

  async function send(e) {
    if (!member) { e.preventDefault(); askUpgrade('community'); return; }
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const { comment } = await api.createComment(post.id, text);
      const next = [...(comments || []), comment];
      setComments(next);
      onCountChange(next.length);
      setText('');
    } catch (err) {
      console.error(err);
      onError(err);
    }
  }

  async function remove(id) {
    try {
      await api.deleteComment(id);
      const next = comments.filter((c) => c.id !== id);
      setComments(next);
      onCountChange(next.length);
    } catch (err) {
      console.error(err);
      onError(err);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      {comments == null ? (
        <p className="text-xs text-muted-foreground">{t('loading')}</p>
      ) : comments.map((c) => (
        <div key={c.id} className={isPrivate ? 'rounded-md border-l-[3px] border-border bg-muted/40 px-3 py-2' : ''}>
          <p className="mb-0.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isPrivate ? (
                `${relativeTime(t, c.created_at)} ${t('cm_self_note')}`
              ) : (
                <>
                  {c.author_name || t('cm_anon')}
                  {c.is_post_author && <span className="ml-1 rounded bg-muted px-1">{t('cm_author_tag')}</span>}
                  {' · '}{relativeTime(t, c.created_at)}
                </>
              )}
            </span>
            {(c.is_mine || isAdmin) && (
              <button type="button" onClick={() => remove(c.id)} className="underline">{t('cm_delete')}</button>
            )}
          </p>
          <p className="whitespace-pre-wrap text-sm">{c.content}</p>
        </div>
      ))}
      <form onSubmit={send} className="flex gap-2">
        <Input
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          placeholder={isPrivate ? t('cm_self_comment_placeholder') : t('cm_comment_placeholder')}
          className="h-8 flex-1"
        />
        <Button type="submit" size="sm" disabled={!text.trim()}>{t('cm_send')}</Button>
      </form>
    </div>
  );
}
