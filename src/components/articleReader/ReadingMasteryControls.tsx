"use client";

/** 从 InteractiveArticleReader.tsx 拆出（2026-10-15，行为不变）。 */
import {
  Button,
} from "@/components/ui/Button";
import type {
  MasteryStatus,
} from "@/lib/types";

export function masterySelectControlValue(status: MasteryStatus): MasteryStatus {
  return status === "mastered" || status === "ignored" ? status : "new";
}

export const readingMasterySelectClassName =
  "h-7 shrink-0 rounded-md border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-800 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

/** 顶行可改学习状态；无障碍文案用 aria-label。 */
export function ReadingMasteryStatusSelect({
  status,
  onStatusChange,
  className,
}: {
  status: MasteryStatus;
  onStatusChange: (status: MasteryStatus) => void;
  className?: string;
}) {
  const selectValue = masterySelectControlValue(status);
  return (
    <select
      value={selectValue}
      aria-label="学习状态"
      title="学习状态"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) =>
        onStatusChange(e.currentTarget.value as MasteryStatus)
      }
      className={
        className
          ? `${readingMasterySelectClassName} ${className}`
          : readingMasterySelectClassName
      }
    >
      <option value="new">学习中</option>
      <option value="mastered">已掌握</option>
      <option value="ignored">暂忽略</option>
    </select>
  );
}

/** 标题行右侧：状态下拉 + 删除；`shrink-0` + `flex-nowrap` 避免把操作挤换行，长标题在左侧 `min-w-0` 区域换行。 */
export function ReadingMasteryTitleActions({
  status,
  onStatusChange,
  onDelete,
  deleteDisabled,
  className,
}: {
  status: MasteryStatus;
  onStatusChange: (status: MasteryStatus) => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={
        className
          ? `flex shrink-0 flex-nowrap items-center gap-1 ${className}`
          : "flex shrink-0 flex-nowrap items-center gap-1"
      }
    >
      <ReadingMasteryStatusSelect
        status={status}
        onStatusChange={onStatusChange}
      />
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          className="h-7 shrink-0 px-2 text-xs text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleteDisabled}
        >
          删除
        </Button>
      ) : null}
    </div>
  );
}
