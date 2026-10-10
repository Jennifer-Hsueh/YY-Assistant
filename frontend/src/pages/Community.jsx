import { useEffect, useState } from 'react';
import { Lock, MessageCircle, ThumbsUp, Users } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';

const TABS = [
  { key: 'mood', emoji: '🌦️' },
  { key: 'finance', emoji: '🐷' },
  { key: 'wish', emoji: '✨' },
  { key: 'mine', emoji: '🔒' },
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
const MOOD_REACTIONS = [
  { key: 'hug', emoji: '🫂' },
  { key: 'cheer', emoji: '💪' },
  { key: 'understand', emoji: '🤝' },
  { key: 'laugh', emoji: '😆' },
  { key: 'approve', emoji: '👍' },
];
const WISH_STATUSES = ['considering', 'planned', 'done'];
// 公開範圍三選一 → { visibility, anonymous }
const SCOPES = [
  { key: 'private', label: 'cm_private', value: { visibility: 'private', anonymous: false } },
  { key: 'anon', label: 'cm_public_anon', value: { visibility: 'public', anonymous: true } },
  { key: 'named', label: 'cm_public_named', value: { visibility: 'public', anonymous: false } },
];
const scopeOf = (p) => (p.visibility === 'private' ? 'private' : p.anonymous ? 'anon' : 'named');

const emptyDraft = { board: 'mood', mood: null, title: '', content: '', scope: 'private' };

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
  const { t } = useLanguage();
  const [tab, setTab] = useState('mood');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [mineFilter, setMineFilter] = useState('all');
  const [stats, setStats] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [composeOpen, setComposeOpen] = useState(false);
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    api.getProfile().then(({ profile }) => setIsAdmin(profile?.role === 'admin')).catch(() => {});
  }, []);

  function refreshStats() {
    api.getCommunityStats().then(({ stats }) => setStats(stats)).catch(() => {});
  }

  async function load({ append = false } = {}) {
    if (!append) setLoading(true);
    setError('');
    try {
      const params = { board: tab };
      if (tab === 'mine' && mineFilter !== 'all') params.visibility = mineFilter;
      if (append && posts.length) params.before = posts[posts.length - 1].created_at;
      const { posts: rows } = await api.listPosts(params);
      setPosts((prev) => (append ? [...prev, ...rows] : rows));
      setHasMore(rows.length === 30);
      if (tab === 'mine') refreshStats();
    } catch (err) {
      console.error(err);
      setError(t('cm_error'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tab, mineFilter]);

  function switchTab(key) {
    setTab(key);
    if (key !== 'mine') setDraft((d) => ({ ...d, board: key }));
  }

  const draftBoard = tab === 'mine' ? draft.board : tab;

  async function publish(e) {
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
        ...scope,
      });
      setDraft({ ...emptyDraft, board: draftBoard, scope: draft.scope });
      setComposeOpen(false);
      // 公開文章出現在目前的板上;私人文章只出現在「我的」
      const showsHere = tab === 'mine'
        ? mineFilter === 'all' || mineFilter === post.visibility
        : post.visibility === 'public' && post.board === tab;
      if (showsHere) setPosts((prev) => [post, ...prev]);
      if (tab === 'mine') refreshStats();
    } catch (err) {
      console.error(err);
      setError(t('cm_error'));
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
          <span className="hidden md:inline">{emoji} </span>{key === 'mine' ? t('cm_mine') : t(`cm_board_${key}`)}
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
          </div>
          <Button type="submit" className="w-full" disabled={posting || !draft.content.trim()}>{t('cm_publish')}</Button>
        </form>
        {draftBoard === 'mood' && (
          <p className="border-t border-dashed border-border pt-3 text-xs text-muted-foreground">{t('cm_help')}</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-24 md:max-w-5xl md:px-8 md:py-10" style={{ '--primary': 'var(--module-accounts)', '--ring': 'var(--module-accounts)' }}>
      <h1 className="page-title-row page-title mb-4 flex items-center gap-2 text-lg font-semibold">
        <Users className="h-5 w-5 md:hidden" style={{ color: 'var(--module-accounts)' }} />
        {t('nav_community')}
      </h1>

      {/* 手機版順序:版別 → 版名介紹 → 寫文章 → 文章列表 */}
      <div className="md:hidden">
        {tabBar}
        {boardIntro}
      </div>

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
                  {[['all', 'cm_filter_all'], ['private', 'cm_private'], ['public', 'cm_stat_public']].map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setMineFilter(k)} className={pillClass(mineFilter === k)}>{t(label)}</button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 手機版:點「寫文章」才展開;桌機版一直顯示 */}
          <button
            type="button"
            onClick={() => setComposeOpen((v) => !v)}
            className="mb-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm md:hidden"
          >
            ✏️ {draftBoard === 'mood' ? t('cm_compose_mood') : t('cm_compose')}
          </button>
          <div className={`mb-4 ${composeOpen ? '' : 'hidden'} md:block`}>{composeCard}</div>
        </div>

        <div className="md:order-1">
          <div className="hidden md:block">{tabBar}</div>

          <div className="hidden md:block">{boardIntro}</div>

          {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

          {loading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : posts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('cm_empty')}</p>
          ) : (
            <div className="space-y-3">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} t={t} inMine={tab === 'mine'} isAdmin={isAdmin} onChange={replacePost} onRemove={removePost} onError={() => setError(t('cm_error'))} />
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
    </div>
  );
}

function PostCard({ post, t, inMine, isAdmin, onChange, onRemove, onError }) {
  const [confirm, setConfirm] = useState(null); // 'delete' | 'report' | 'reported'
  const [scopeOpen, setScopeOpen] = useState(false);
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
    try { await fn(); } catch (err) { console.error(err); onError(); }
  }

  const react = (type) => run(async () => { const { post: p } = await api.reactToPost(post.id, type); onChange(p); });
  const changeScope = (key) => run(async () => {
    const { post: p } = await api.updatePost(post.id, SCOPES.find((s) => s.key === key).value);
    setScopeOpen(false);
    // 在板上改成「僅自己」= 從板上收回
    if (inMine || p.visibility === 'public') onChange(p); else onRemove(post.id);
  });
  const remove = () => run(async () => { await api.deletePost(post.id); onRemove(post.id); });
  const report = () => run(async () => { await api.reportPost(post.id); setConfirm('reported'); });
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
              </>
            ) : (
              <span>{displayName}</span>
            )}
          </span>
          <span className="shrink-0">{relativeTime(t, post.created_at)}</span>
        </div>

        {post.title && <p className="mb-1 font-semibold">{post.title}</p>}
        <p className="whitespace-pre-wrap leading-relaxed">{post.content}</p>
        {post.hidden && <p className="mt-2 text-xs text-muted-foreground">{t('cm_post_hidden')}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isMoodPublic && MOOD_REACTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => react(r.key)}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${post.my_reaction === r.key ? 'border-foreground bg-muted text-foreground' : 'border-border text-muted-foreground hover:bg-muted/60'}`}
            >
              {r.emoji} {t(`cm_r_${r.key}`)} {post.reactions[r.key] || 0}
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
            {post.is_mine && (
              <button type="button" onClick={() => setScopeOpen((v) => !v)} className="underline">{t('cm_change_visibility')}</button>
            )}
            {(post.is_mine || isAdmin) && (
              <button type="button" onClick={() => setConfirm('delete')} className="underline">{t('cm_delete')}</button>
            )}
            {!post.is_mine && confirm !== 'reported' && (
              <button type="button" onClick={() => setConfirm('report')} className="underline">{t('cm_report')}</button>
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
          </div>
        )}

        {(confirm === 'delete' || confirm === 'report') && (
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
  const [comments, setComments] = useState(null);
  const [text, setText] = useState('');
  const isPrivate = post.visibility === 'private';

  useEffect(() => {
    api.listComments(post.id)
      .then(({ comments }) => setComments(comments))
      .catch((err) => { console.error(err); setComments([]); });
  }, [post.id]);

  async function send(e) {
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
      onError();
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
      onError();
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
