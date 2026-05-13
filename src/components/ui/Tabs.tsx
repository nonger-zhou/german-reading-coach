"use client";

import type { ReactNode, RefObject } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({
  items,
  activeId,
  onChange,
  panelScrollRef,
}: {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  /** 右侧 Tab 内容区滚动容器，用于列表项 scrollIntoView 与左侧联动 */
  panelScrollRef?: RefObject<HTMLDivElement | null>;
}) {
  const active = items.find((t) => t.id === activeId) ?? items[0];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        className="flex gap-1 overflow-x-auto border-b border-zinc-200 pb-px dark:border-zinc-800"
        role="tablist"
      >
        {items.map((tab) => {
          const selected = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              className={`shrink-0 rounded-t-md px-3 py-2 text-sm font-medium transition ${
                selected
                  ? "border-b-2 border-emerald-600 text-emerald-800 dark:text-emerald-300"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        ref={panelScrollRef}
        className="min-h-0 flex-1 overflow-y-auto pt-3"
        role="tabpanel"
      >
        {active?.content}
      </div>
    </div>
  );
}
