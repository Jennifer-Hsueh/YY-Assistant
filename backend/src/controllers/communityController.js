const supabase = require('../config/supabase');

// 社群:三個板 + 「我的」。
// 可見性一律由後端判斷 —— 私人文章只回傳給作者本人,
// 被檢舉隱藏的文章不出現在板上;回傳資料不含其他人的 user_id / email。
const BOARDS = ['mood', 'finance', 'wish'];
const MOODS = ['sunny', 'cloudy', 'rainy', 'storm', 'rainbow'];
const MOOD_REACTIONS = ['hug', 'cheer', 'understand', 'laugh', 'approve'];
const WISH_STATUSES = ['considering', 'planned', 'done'];
const REPORT_HIDE_THRESHOLD = 3;
const MAX_CONTENT = 2000;
const MAX_TITLE = 80;
const PAGE_SIZE = 30;

async function isAdmin(userId) {
  const { data } = await supabase.from('yy_users').select('role').eq('id', userId).maybeSingle();
  return data?.role === 'admin';
}

function clean(text, max) {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, max);
}

// 晴空與雨天的公開文章:只有回應,不開放其他人留言
function commentsAllowed(post, userId) {
  if (post.visibility === 'private') return post.user_id === userId;
  return post.board !== 'mood';
}

function canRead(post, userId, admin) {
  if (post.user_id === userId) return true;
  if (post.visibility !== 'public') return false;
  return !post.hidden || admin;
}

async function decorate(posts, userId) {
  if (posts.length === 0) return [];
  const ids = posts.map((p) => p.id);
  const authorIds = [...new Set(posts.map((p) => p.user_id))];
  const [{ data: reactions }, { data: comments }, { data: authors }] = await Promise.all([
    supabase.from('yy_post_reactions').select('post_id, user_id, type').in('post_id', ids),
    supabase.from('yy_post_comments').select('post_id').in('post_id', ids),
    supabase.from('yy_users').select('id, username, email').in('id', authorIds),
  ]);
  return posts.map((p) => {
    const mine = p.user_id === userId;
    const author = (authors || []).find((a) => a.id === p.user_id);
    const counts = {};
    let myReaction = null;
    for (const r of reactions || []) {
      if (r.post_id !== p.id) continue;
      counts[r.type] = (counts[r.type] || 0) + 1;
      if (r.user_id === userId) myReaction = r.type;
    }
    const { user_id, ...rest } = p;
    return {
      ...rest,
      is_mine: mine,
      author_name: p.anonymous && !mine ? null : (author?.username || author?.email?.split('@')[0] || ''),
      reactions: counts,
      my_reaction: myReaction,
      comment_count: (comments || []).filter((c) => c.post_id === p.id).length,
    };
  });
}

async function fetchPost(id) {
  const { data, error } = await supabase.from('yy_posts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// GET /community/posts?board=mood|finance|wish|mine&visibility=private|public&before=ISO
async function listPosts(req, res) {
  try {
    const { board, visibility, before } = req.query;
    let q = supabase.from('yy_posts').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE);
    if (board === 'mine') {
      q = q.eq('user_id', req.user.id);
      if (visibility === 'private' || visibility === 'public') q = q.eq('visibility', visibility);
    } else if (BOARDS.includes(board)) {
      q = q.eq('board', board).eq('visibility', 'public').eq('hidden', false);
    } else {
      return res.status(400).json({ error: 'Invalid board' });
    }
    if (before) q = q.lt('created_at', before);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ posts: await decorate(data, req.user.id) });
  } catch (err) {
    console.error('[communityController.listPosts]', err);
    return res.status(500).json({ error: 'Failed to fetch posts' });
  }
}

// GET /community/stats — 「我的」統計
async function myStats(req, res) {
  try {
    const { data: posts, error } = await supabase.from('yy_posts').select('id, visibility').eq('user_id', req.user.id);
    if (error) throw error;
    const ids = posts.map((p) => p.id);
    let received = 0;
    if (ids.length) {
      const { count } = await supabase
        .from('yy_post_reactions')
        .select('post_id', { count: 'exact', head: true })
        .in('post_id', ids)
        .neq('user_id', req.user.id);
      received = count || 0;
    }
    return res.json({
      stats: {
        private: posts.filter((p) => p.visibility === 'private').length,
        public: posts.filter((p) => p.visibility === 'public').length,
        reactions_received: received,
      },
    });
  } catch (err) {
    console.error('[communityController.myStats]', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

async function createPost(req, res) {
  try {
    const { board, visibility, anonymous, mood, title } = req.body;
    const content = clean(req.body.content, MAX_CONTENT);
    if (!BOARDS.includes(board)) return res.status(400).json({ error: 'Invalid board' });
    if (!content) return res.status(400).json({ error: 'content is required' });
    if (board === 'mood' && mood != null && !MOODS.includes(mood)) return res.status(400).json({ error: 'Invalid mood' });

    const { data, error } = await supabase
      .from('yy_posts')
      .insert({
        user_id: req.user.id,
        board,
        visibility: visibility === 'public' ? 'public' : 'private',
        anonymous: !!anonymous,
        mood: board === 'mood' ? mood || null : null,
        title: board === 'mood' ? null : clean(title, MAX_TITLE) || null,
        content,
      })
      .select()
      .single();
    if (error) throw error;
    const [post] = await decorate([data], req.user.id);
    return res.status(201).json({ post });
  } catch (err) {
    console.error('[communityController.createPost]', err);
    return res.status(500).json({ error: 'Failed to create post' });
  }
}

// 作者可改內容與公開範圍(公開 → 僅自己 = 從板上收回)
async function updatePost(req, res) {
  try {
    const post = await fetchPost(req.params.id);
    if (!post || post.user_id !== req.user.id) return res.status(404).json({ error: 'Post not found' });
    const updates = { updated_at: new Date().toISOString() };
    const { visibility, anonymous, mood, title, content } = req.body;
    if (visibility !== undefined) updates.visibility = visibility === 'public' ? 'public' : 'private';
    if (anonymous !== undefined) updates.anonymous = !!anonymous;
    if (mood !== undefined && post.board === 'mood') {
      if (mood !== null && !MOODS.includes(mood)) return res.status(400).json({ error: 'Invalid mood' });
      updates.mood = mood;
    }
    if (title !== undefined && post.board !== 'mood') updates.title = clean(title, MAX_TITLE) || null;
    if (content !== undefined) {
      const c = clean(content, MAX_CONTENT);
      if (!c) return res.status(400).json({ error: 'content is required' });
      updates.content = c;
    }
    const { data, error } = await supabase.from('yy_posts').update(updates).eq('id', post.id).select().single();
    if (error) throw error;
    const [decorated] = await decorate([data], req.user.id);
    return res.json({ post: decorated });
  } catch (err) {
    console.error('[communityController.updatePost]', err);
    return res.status(500).json({ error: 'Failed to update post' });
  }
}

async function deletePost(req, res) {
  try {
    const post = await fetchPost(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id && !(await isAdmin(req.user.id))) {
      return res.status(404).json({ error: 'Post not found' });
    }
    const { error } = await supabase.from('yy_posts').delete().eq('id', post.id);
    if (error) throw error;
    return res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('[communityController.deletePost]', err);
    return res.status(500).json({ error: 'Failed to delete post' });
  }
}

async function listComments(req, res) {
  try {
    const post = await fetchPost(req.params.id);
    const admin = post && post.user_id !== req.user.id ? await isAdmin(req.user.id) : false;
    if (!post || !canRead(post, req.user.id, admin)) return res.status(404).json({ error: 'Post not found' });
    const { data, error } = await supabase
      .from('yy_post_comments')
      .select('id, user_id, content, created_at')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const authorIds = [...new Set(data.map((c) => c.user_id))];
    const { data: authors } = authorIds.length
      ? await supabase.from('yy_users').select('id, username, email').in('id', authorIds)
      : { data: [] };
    const comments = data.map(({ user_id, ...c }) => {
      const a = (authors || []).find((x) => x.id === user_id);
      return {
        ...c,
        is_mine: user_id === req.user.id,
        is_post_author: user_id === post.user_id,
        // 匿名文章的作者在自己的文章下留言,也維持匿名
        author_name: user_id === post.user_id && post.anonymous && user_id !== req.user.id
          ? null
          : (a?.username || a?.email?.split('@')[0] || ''),
      };
    });
    return res.json({ comments });
  } catch (err) {
    console.error('[communityController.listComments]', err);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
}

async function createComment(req, res) {
  try {
    const post = await fetchPost(req.params.id);
    if (!post || !canRead(post, req.user.id, false) || post.hidden) return res.status(404).json({ error: 'Post not found' });
    if (!commentsAllowed(post, req.user.id)) return res.status(403).json({ error: 'Comments are not allowed on this post' });
    const content = clean(req.body.content, MAX_CONTENT);
    if (!content) return res.status(400).json({ error: 'content is required' });
    const { data, error } = await supabase
      .from('yy_post_comments')
      .insert({ post_id: post.id, user_id: req.user.id, content })
      .select('id, content, created_at')
      .single();
    if (error) throw error;
    const { data: me } = await supabase.from('yy_users').select('username, email').eq('id', req.user.id).maybeSingle();
    return res.status(201).json({
      comment: {
        ...data,
        is_mine: true,
        is_post_author: post.user_id === req.user.id,
        author_name: me?.username || me?.email?.split('@')[0] || '',
      },
    });
  } catch (err) {
    console.error('[communityController.createComment]', err);
    return res.status(500).json({ error: 'Failed to create comment' });
  }
}

async function deleteComment(req, res) {
  try {
    const { data: comment, error: fErr } = await supabase
      .from('yy_post_comments').select('id, user_id').eq('id', req.params.id).maybeSingle();
    if (fErr) throw fErr;
    if (!comment || (comment.user_id !== req.user.id && !(await isAdmin(req.user.id)))) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    const { error } = await supabase.from('yy_post_comments').delete().eq('id', comment.id);
    if (error) throw error;
    return res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('[communityController.deleteComment]', err);
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
}

// 每人每篇一種回應:同一種再點一次 = 取消;點不同的 = 換成新的
async function react(req, res) {
  try {
    const post = await fetchPost(req.params.id);
    if (!post || post.visibility !== 'public' || post.hidden) return res.status(404).json({ error: 'Post not found' });
    const { type } = req.body;
    const allowed = post.board === 'mood' ? MOOD_REACTIONS : ['like'];
    if (!allowed.includes(type)) return res.status(400).json({ error: 'Invalid reaction' });

    const { data: existing } = await supabase
      .from('yy_post_reactions').select('type').eq('post_id', post.id).eq('user_id', req.user.id).maybeSingle();
    if (existing?.type === type) {
      await supabase.from('yy_post_reactions').delete().eq('post_id', post.id).eq('user_id', req.user.id);
    } else {
      const { error } = await supabase
        .from('yy_post_reactions')
        .upsert({ post_id: post.id, user_id: req.user.id, type }, { onConflict: 'post_id,user_id' });
      if (error) throw error;
    }
    const [decorated] = await decorate([post], req.user.id);
    return res.json({ post: decorated });
  } catch (err) {
    console.error('[communityController.react]', err);
    return res.status(500).json({ error: 'Failed to react' });
  }
}

async function report(req, res) {
  try {
    const post = await fetchPost(req.params.id);
    if (!post || post.visibility !== 'public' || post.user_id === req.user.id) return res.status(404).json({ error: 'Post not found' });
    const { error } = await supabase
      .from('yy_post_reports')
      .upsert({ post_id: post.id, user_id: req.user.id, reason: clean(req.body.reason, 200) || null }, { onConflict: 'post_id,user_id' });
    if (error) throw error;
    const { count } = await supabase
      .from('yy_post_reports').select('id', { count: 'exact', head: true }).eq('post_id', post.id);
    if ((count || 0) >= REPORT_HIDE_THRESHOLD && !post.hidden) {
      await supabase.from('yy_posts').update({ hidden: true }).eq('id', post.id);
    }
    return res.json({ message: 'Reported' });
  } catch (err) {
    console.error('[communityController.report]', err);
    return res.status(500).json({ error: 'Failed to report' });
  }
}

// 小編許願池:只有管理員能標狀態
async function setWishStatus(req, res) {
  try {
    if (!(await isAdmin(req.user.id))) return res.status(403).json({ error: 'Admin only' });
    const post = await fetchPost(req.params.id);
    if (!post || post.board !== 'wish') return res.status(404).json({ error: 'Post not found' });
    const { wish_status } = req.body;
    if (wish_status !== null && !WISH_STATUSES.includes(wish_status)) return res.status(400).json({ error: 'Invalid status' });
    const { data, error } = await supabase.from('yy_posts').update({ wish_status }).eq('id', post.id).select().single();
    if (error) throw error;
    const [decorated] = await decorate([data], req.user.id);
    return res.json({ post: decorated });
  } catch (err) {
    console.error('[communityController.setWishStatus]', err);
    return res.status(500).json({ error: 'Failed to update status' });
  }
}

module.exports = {
  listPosts, myStats, createPost, updatePost, deletePost,
  listComments, createComment, deleteComment, react, report, setWishStatus,
};
