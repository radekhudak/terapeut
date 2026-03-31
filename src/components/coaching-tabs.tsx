type CoachingTab = "chat" | "tasks" | "topics";

interface CoachingTabsProps {
  activeTab: CoachingTab;
  onChange: (tab: CoachingTab) => void;
}

export function CoachingTabs({ activeTab, onChange }: CoachingTabsProps) {
  const tabs: Array<{ id: CoachingTab; label: string }> = [
    { id: "chat", label: "Chat" },
    { id: "tasks", label: "Ukoly" },
    { id: "topics", label: "Temata" },
  ];

  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
            activeTab === tab.id
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100"
              : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export type { CoachingTab };
