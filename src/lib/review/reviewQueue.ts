import {
  DEFAULT_LEARNING_LANGUAGE,
  type LearningLanguage,
} from "@/lib/language/learningLanguage";

/**
 * 复习调度（简化 Leitner 盒子法）。
 *
 * - 只复习总词库里「学习中」（new / learning / familiar）的词。
 * - 「记住了」：盒子 +1，下次复习间隔按盒子递增（1 → 3 → 7 → 14 → 30 天）。
 * - 「还不熟」：回到第 1 盒，明天再复习。
 * - 「已掌握」：由页面直接把总词库状态改为 mastered（不再推荐、不再复习），这里只删掉调度记录。
 *
 * 调度记录优先存数据库（表 vocabulary_review_progress，迁移 012，所有设备一致）；
 * 未执行 012 时退回浏览器本地（每个账号每种语言一份）。「已掌握」写入总词库。
 */

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
export const DEFAULT_SESSION_SIZE = 20;

export type ReviewEntry = {
  /** 1 起，对应 REVIEW_INTERVAL_DAYS[box - 1] */
  box: number;
  /** 下次应复习的时间（ISO） */
  due: string;
};

export type ReviewState = Record<string, ReviewEntry>;

export type ReviewCandidate = {
  id: string;
  /** 最近一次在文章中遇到 / 更新的时间，用于给从未复习过的词排序 */
  lastSeenAt: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 选出本组要复习的词：
 * 1. 已到期的（按到期时间从早到晚）；
 * 2. 从未复习过的（最近在文章里遇到的优先）；
 * 未到期的不出现。
 */
export function buildReviewQueue(
  candidates: ReadonlyArray<ReviewCandidate>,
  state: ReviewState,
  now: Date,
  size = DEFAULT_SESSION_SIZE,
): string[] {
  const nowMs = now.getTime();
  const due: { id: string; dueMs: number }[] = [];
  const fresh: { id: string; seenMs: number }[] = [];
  for (const c of candidates) {
    const entry = state[c.id];
    if (entry) {
      const dueMs = Date.parse(entry.due);
      if (Number.isFinite(dueMs) && dueMs <= nowMs) due.push({ id: c.id, dueMs });
    } else {
      const seenMs = c.lastSeenAt ? Date.parse(c.lastSeenAt) : 0;
      fresh.push({ id: c.id, seenMs: Number.isFinite(seenMs) ? seenMs : 0 });
    }
  }
  due.sort((a, b) => a.dueMs - b.dueMs);
  fresh.sort((a, b) => b.seenMs - a.seenMs);
  return [...due.map((d) => d.id), ...fresh.map((f) => f.id)].slice(0, size);
}

/** 统计：当前有多少词到期 / 从未复习 / 未到期 */
export function countReviewBuckets(
  candidates: ReadonlyArray<ReviewCandidate>,
  state: ReviewState,
  now: Date,
): { due: number; fresh: number; later: number } {
  let due = 0;
  let fresh = 0;
  let later = 0;
  for (const c of candidates) {
    const entry = state[c.id];
    if (!entry) fresh += 1;
    else if (Date.parse(entry.due) <= now.getTime()) due += 1;
    else later += 1;
  }
  return { due, fresh, later };
}

export function applyReviewAnswer(
  state: ReviewState,
  id: string,
  answer: "again" | "good",
  now: Date,
): ReviewState {
  const prevBox = state[id]?.box ?? 0;
  const box =
    answer === "again" ? 1 : Math.min(prevBox + 1, REVIEW_INTERVAL_DAYS.length);
  const days = REVIEW_INTERVAL_DAYS[box - 1];
  return {
    ...state,
    [id]: { box, due: new Date(now.getTime() + days * DAY_MS).toISOString() },
  };
}

export function removeFromReview(state: ReviewState, id: string): ReviewState {
  if (!(id in state)) return state;
  const next = { ...state };
  delete next[id];
  return next;
}

/** 只保留仍在「学习中」的词，避免状态被改后记录残留 */
export function pruneReviewState(
  state: ReviewState,
  learningIds: ReadonlySet<string>,
): ReviewState {
  const next: ReviewState = {};
  for (const [id, entry] of Object.entries(state)) {
    if (learningIds.has(id)) next[id] = entry;
  }
  return next;
}

const STORAGE_PREFIX = "grc.review.v1.";

/**
 * 复习排期的本机存储 key，按语言分开：
 * - 德语沿用**原来的** key（`grc.review.v1.<userId>`），已有的德语复习进度不受影响；
 * - 英语用新 key（`grc.review.v1.en.<userId>`）。
 * 必须分开：`pruneReviewState` 会删掉不在本次词表里的记录，共用一个 key 时英语复习会清掉德语进度。
 */
export function reviewStorageKey(
  userId: string,
  language: LearningLanguage = DEFAULT_LEARNING_LANGUAGE,
): string {
  return language === "de" ? STORAGE_PREFIX + userId : `${STORAGE_PREFIX}${language}.${userId}`;
}

export function loadReviewState(
  userId: string,
  language: LearningLanguage = DEFAULT_LEARNING_LANGUAGE,
): ReviewState {
  try {
    const raw = window.localStorage.getItem(reviewStorageKey(userId, language));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: ReviewState = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      const e = v as Partial<ReviewEntry>;
      if (typeof e?.box === "number" && typeof e?.due === "string") {
        out[id] = { box: e.box, due: e.due };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveReviewState(
  userId: string,
  state: ReviewState,
  language: LearningLanguage = DEFAULT_LEARNING_LANGUAGE,
): void {
  try {
    window.localStorage.setItem(reviewStorageKey(userId, language), JSON.stringify(state));
  } catch {
    /* 隐私模式等情况下无法保存，只影响排期，不影响复习本身 */
  }
}

/** 排期已搬进数据库后，清掉本机副本，避免以后被重复搬回 */
export function clearReviewState(
  userId: string,
  language: LearningLanguage = DEFAULT_LEARNING_LANGUAGE,
): void {
  try {
    window.localStorage.removeItem(reviewStorageKey(userId, language));
  } catch {
    /* ignore */
  }
}
