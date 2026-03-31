import type { CoachingTask } from "@/hooks/use-coaching-tasks";

interface CoachingTaskListProps {
  tasks: CoachingTask[];
  onUpdate: (
    taskId: string,
    patch: Partial<{
      title: string;
      description: string;
      status: CoachingTask["status"];
      priority: CoachingTask["priority"];
      progressPct: number;
    }>
  ) => Promise<void> | void;
}

export function CoachingTaskList({ tasks, onUpdate }: CoachingTaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-4 text-sm text-neutral-500">
        Zatím nejsou domluvené žádné úkoly.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm">{task.title}</p>
            <select
              value={task.status}
              onChange={(e) =>
                onUpdate(task.id, { status: e.target.value as CoachingTask["status"] })
              }
              className="text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1"
            >
              <option value="todo">todo</option>
              <option value="in_progress">in progress</option>
              <option value="done">done</option>
              <option value="skipped">skipped</option>
            </select>
          </div>
          {task.description ? (
            <p className="text-xs text-neutral-500 mt-1">{task.description}</p>
          ) : null}
          <div className="mt-2 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-neutral-900 dark:bg-neutral-100"
              style={{ width: `${Math.max(0, Math.min(100, task.progressPct))}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
            <span>Priority: {task.priority}</span>
            <span>{task.progressPct}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
