// Records as the API sends them: timestamps become ISO strings in JSON. Calendar dates stay
// 'YYYY-MM-DD'.

export interface Project {
  id: number
  ownerId: number
  name: string
  description: string
  status: ProjectStatus
  priority: Priority
  startDate: string | null
  deadline: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  taskCount: number
  doneCount: number
}

export interface Task {
  id: number
  projectId: number
  projectName: string
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  dueDate: string | null
  estimateMinutes: number | null
  position: number
  completedAt: string | null
  createdAt: string
  updatedAt: string
  tagIds: number[]
  commentCount: number
}

export interface Tag {
  id: number
  ownerId: number
  name: string
  color: TagColor
  createdAt: string
}

export interface TaskComment {
  id: number
  taskId: number
  authorId: number
  authorName: string
  body: string
  createdAt: string
}

export interface ActivityEntry {
  id: number
  userId: number
  projectId: number | null
  taskId: number | null
  action: string
  subject: string
  detail: Record<string, string> | null
  createdAt: string
}
