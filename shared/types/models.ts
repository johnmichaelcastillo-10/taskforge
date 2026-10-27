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
