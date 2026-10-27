// Value lists shared by the database schema (CHECK constraints), validation and the UI.

export const PROJECT_STATUSES = ['planning', 'in_progress', 'completed'] as const
export type ProjectStatus = typeof PROJECT_STATUSES[number]

/** The board's columns, in order. */
export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'done'] as const
export type TaskStatus = typeof TASK_STATUSES[number]

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

export const PRIORITIES = ['low', 'medium', 'high'] as const
export type Priority = typeof PRIORITIES[number]

export const TAG_COLORS = ['gray', 'red', 'orange', 'amber', 'green', 'teal', 'sky', 'indigo', 'purple', 'pink'] as const
export type TagColor = typeof TAG_COLORS[number]

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  in_progress: 'In progress',
  completed: 'Completed',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}
