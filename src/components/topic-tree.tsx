import { useMemo } from "react";
import type { TopicNode } from "@/hooks/use-topic-tree";

interface TopicTreeProps {
  topics: TopicNode[];
  activeTopicId: string | null;
  onSpeakTopic: (topicId: string) => void;
}

export function TopicTree({
  topics,
  activeTopicId,
  onSpeakTopic,
}: TopicTreeProps) {
  const byParent = useMemo(() => {
    const map = new Map<string | null, TopicNode[]>();
    for (const topic of topics) {
      const key = topic.parentId ?? null;
      const list = map.get(key) ?? [];
      list.push(topic);
      map.set(key, list);
    }
    return map;
  }, [topics]);

  const roots = byParent.get(null) ?? [];
  if (roots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-4 text-sm text-neutral-500">
        Strom témat je zatím prázdný.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {roots.map((root) => (
        <TopicNodeItem
          key={root.id}
          node={root}
          byParent={byParent}
          activeTopicId={activeTopicId}
          onSpeakTopic={onSpeakTopic}
          depth={0}
        />
      ))}
    </div>
  );
}

function TopicNodeItem({
  node,
  byParent,
  activeTopicId,
  onSpeakTopic,
  depth,
}: {
  node: TopicNode;
  byParent: Map<string | null, TopicNode[]>;
  activeTopicId: string | null;
  onSpeakTopic: (topicId: string) => void;
  depth: number;
}) {
  const children = byParent.get(node.id) ?? [];

  return (
    <div className={`rounded-xl border p-3 ${depth > 0 ? "ml-4" : ""} ${
      activeTopicId === node.id
        ? "border-blue-400 dark:border-blue-500"
        : "border-neutral-200 dark:border-neutral-800"
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{node.title}</p>
          <p className="text-xs text-neutral-500">{node.progressPct}% progress</p>
        </div>
        <button
          onClick={() => onSpeakTopic(node.id)}
          className="text-xs px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Mluvit o tomto
        </button>
      </div>
      {node.notes[0] ? (
        <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
          {node.notes[0].content}
        </p>
      ) : null}
      {children.length > 0 ? (
        <div className="mt-2 space-y-2">
          {children.map((child) => (
            <TopicNodeItem
              key={child.id}
              node={child}
              byParent={byParent}
              activeTopicId={activeTopicId}
              onSpeakTopic={onSpeakTopic}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
