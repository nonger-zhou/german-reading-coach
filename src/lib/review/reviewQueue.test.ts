import { describe, expect, it } from "vitest";
import {
  applyReviewAnswer,
  buildReviewQueue,
  countReviewBuckets,
  pruneReviewState,
  removeFromReview,
  type ReviewState,
} from "./reviewQueue";

const now = new Date("2026-10-15T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(now.getTime() + offsetDays * day).toISOString();

describe("复习队列", () => {
  it("先到期的，再从未复习的（最近遇到的优先），未到期的不出现", () => {
    const state: ReviewState = {
      a: { box: 1, due: iso(-2) },
      b: { box: 2, due: iso(-1) },
      c: { box: 3, due: iso(+3) },
    };
    const queue = buildReviewQueue(
      [
        { id: "a", lastSeenAt: null },
        { id: "b", lastSeenAt: null },
        { id: "c", lastSeenAt: null },
        { id: "d", lastSeenAt: iso(-10) },
        { id: "e", lastSeenAt: iso(-1) },
      ],
      state,
      now,
    );
    expect(queue).toEqual(["a", "b", "e", "d"]);
  });

  it("每组最多 size 个", () => {
    const cands = Array.from({ length: 50 }, (_, i) => ({ id: `w${i}`, lastSeenAt: null }));
    expect(buildReviewQueue(cands, {}, now, 20)).toHaveLength(20);
  });

  it("记住了：盒子递增、间隔变长；还不熟：回到第 1 盒、明天再来", () => {
    let s = applyReviewAnswer({}, "x", "good", now);
    expect(s.x).toEqual({ box: 1, due: iso(1) });
    s = applyReviewAnswer(s, "x", "good", now);
    expect(s.x).toEqual({ box: 2, due: iso(3) });
    s = applyReviewAnswer(s, "x", "again", now);
    expect(s.x).toEqual({ box: 1, due: iso(1) });
  });

  it("最高盒子封顶 30 天", () => {
    let s: ReviewState = {};
    for (let i = 0; i < 10; i++) s = applyReviewAnswer(s, "x", "good", now);
    expect(s.x.due).toBe(iso(30));
  });

  it("已掌握 / 状态改掉后删除记录；统计到期与未复习数量", () => {
    const s: ReviewState = { a: { box: 1, due: iso(-1) }, b: { box: 1, due: iso(2) } };
    expect(removeFromReview(s, "a")).toEqual({ b: s.b });
    expect(pruneReviewState(s, new Set(["b"]))).toEqual({ b: s.b });
    expect(
      countReviewBuckets(
        [
          { id: "a", lastSeenAt: null },
          { id: "b", lastSeenAt: null },
          { id: "c", lastSeenAt: null },
        ],
        s,
        now,
      ),
    ).toEqual({ due: 1, fresh: 1, later: 1 });
  });
});
