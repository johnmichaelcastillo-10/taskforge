// How each kind of activity entry reads in the feed.

// Task and project statuses share 'in_progress', which reads the same in both.
const STATUS_NAMES: Record<string, string> = { ...PROJECT_STATUS_LABELS, ...TASK_STATUS_LABELS }

function statusName(value: string | undefined): string {
  return value ? (STATUS_NAMES[value] ?? value) : ''
}

export function describeActivity(entry: ActivityEntry): { icon: string, text: string } {
  const subject = `“${entry.subject}”`
  const from = statusName(entry.detail?.from)
  const to = statusName(entry.detail?.to)
  switch (entry.action) {
    case 'project.created': return { icon: 'i-lucide-folder-plus', text: `Created project ${subject}` }
    case 'project.updated': return { icon: 'i-lucide-pencil', text: `Edited project ${subject}` }
    case 'project.status': return { icon: 'i-lucide-flag', text: `Changed ${subject} from ${from} to ${to}` }
    case 'project.archived': return { icon: 'i-lucide-archive', text: `Archived project ${subject}` }
    case 'project.restored': return { icon: 'i-lucide-archive-restore', text: `Restored project ${subject}` }
    case 'project.deleted': return { icon: 'i-lucide-trash-2', text: `Deleted project ${subject}` }
    case 'task.created': return { icon: 'i-lucide-square-plus', text: `Added task ${subject}` }
    case 'task.updated': return { icon: 'i-lucide-pencil', text: `Edited task ${subject}` }
    case 'task.moved': return { icon: 'i-lucide-move-right', text: `Moved ${subject} from ${from} to ${to}` }
    case 'task.completed': return { icon: 'i-lucide-circle-check', text: `Completed ${subject}` }
    case 'task.reopened': return { icon: 'i-lucide-rotate-ccw', text: `Reopened ${subject}` }
    case 'task.deleted': return { icon: 'i-lucide-trash-2', text: `Deleted task ${subject}` }
    case 'comment.added': return { icon: 'i-lucide-message-square', text: `Commented on ${subject}` }
    default: return { icon: 'i-lucide-dot', text: `${entry.action} ${subject}` }
  }
}
