import { activityLogs, projects, tags, taskComments, taskTags, tasks, workSessions, type users } from '../database/schema'
import type { Executor } from '../utils/db'

type Account = typeof users.$inferSelect

interface SampleTask {
  title: string
  status: TaskStatus
  priority: Priority
  /** Days from today; negative is in the past. */
  due?: number
  estimate?: number
  tags?: string[]
  /** For done tasks: how many days ago it was finished. */
  completed?: number
}

const SAMPLE_TAGS: Record<string, TagColor> = {
  frontend: 'indigo',
  backend: 'teal',
  bug: 'red',
  docs: 'amber',
  design: 'pink',
  devops: 'sky',
}

// One list per sample project, in the order seeded below.
const SAMPLE_TASKS: SampleTask[][] = [
  [
    { title: 'Audit the current site with Lighthouse', status: 'done', priority: 'medium', estimate: 60, tags: ['frontend'], completed: 18 },
    { title: 'Wireframe the new home page', status: 'done', priority: 'high', due: -14, estimate: 180, tags: ['design'], completed: 15 },
    { title: 'Pick a type scale and colour tokens', status: 'done', priority: 'medium', estimate: 120, tags: ['design', 'frontend'], completed: 12 },
    { title: 'Build the case study template', status: 'in_progress', priority: 'high', due: 3, estimate: 360, tags: ['frontend'] },
    { title: 'Optimise hero images (WebP, sizes)', status: 'in_progress', priority: 'medium', due: 5, estimate: 90, tags: ['frontend'] },
    { title: 'Fix layout shift on the mobile nav', status: 'todo', priority: 'high', due: -2, estimate: 60, tags: ['bug', 'frontend'] },
    { title: 'Write three case studies', status: 'todo', priority: 'high', due: 8, estimate: 480, tags: ['docs'] },
    { title: 'Set up preview deploys', status: 'backlog', priority: 'low', estimate: 45, tags: ['devops'] },
    { title: 'Add an RSS feed', status: 'backlog', priority: 'low', tags: ['frontend'] },
  ],
  [
    { title: 'Design the v2 resource layout', status: 'done', priority: 'high', estimate: 240, tags: ['backend', 'docs'], completed: 28 },
    { title: 'Token authentication', status: 'done', priority: 'high', estimate: 300, tags: ['backend'], completed: 18 },
    { title: 'Cursor pagination for /orders', status: 'done', priority: 'medium', estimate: 180, tags: ['backend'], completed: 9 },
    { title: 'Consistent error format', status: 'done', priority: 'medium', estimate: 90, tags: ['backend'], completed: 6 },
    { title: 'Rate-limit headers', status: 'done', priority: 'medium', estimate: 120, tags: ['backend'], completed: 4 },
    { title: 'Health check endpoint', status: 'done', priority: 'low', estimate: 30, tags: ['backend', 'devops'], completed: 2 },
    { title: 'Deprecation notices for v1', status: 'in_progress', priority: 'medium', due: 6, estimate: 90, tags: ['backend', 'docs'] },
    { title: 'Timeouts on slow report queries', status: 'todo', priority: 'high', due: -1, estimate: 120, tags: ['bug', 'backend'] },
    { title: 'Webhook retries with backoff', status: 'todo', priority: 'high', due: 12, estimate: 300, tags: ['backend'] },
    { title: 'OpenAPI docs for v2', status: 'backlog', priority: 'medium', due: 20, estimate: 240, tags: ['docs'] },
    { title: 'Load-test the new endpoints', status: 'backlog', priority: 'low', estimate: 180, tags: ['devops'] },
  ],
  [
    { title: 'Outline the guide', status: 'todo', priority: 'medium', due: 7, estimate: 60, tags: ['docs'] },
    { title: 'Screenshots of the setup steps', status: 'backlog', priority: 'low', estimate: 90, tags: ['docs', 'design'] },
    { title: 'List good first issues', status: 'backlog', priority: 'low', estimate: 30, tags: ['docs'] },
  ],
  [
    { title: 'Map invoice fields to the new provider', status: 'done', priority: 'high', estimate: 120, tags: ['backend'], completed: 50 },
    { title: 'Dual-write invoices for a week', status: 'done', priority: 'high', estimate: 240, tags: ['backend', 'devops'], completed: 35 },
    { title: 'Switch subscriptions over', status: 'done', priority: 'high', estimate: 180, tags: ['backend'], completed: 16 },
    { title: 'Fix proration rounding', status: 'done', priority: 'medium', estimate: 60, tags: ['bug', 'backend'], completed: 13 },
  ],
  [
    { title: 'Export the old reports', status: 'done', priority: 'low', completed: 75 },
    { title: 'Redirect the old URLs', status: 'done', priority: 'low', completed: 72 },
  ],
]

const SAMPLE_COMMENTS: Record<string, { body: string, daysAgo: number }[]> = {
  'Build the case study template': [
    { body: 'Using the same grid as the blog, so the spacing matches.', daysAgo: 2 },
    { body: 'Images need fixed aspect ratios or the layout shifts while they load.', daysAgo: 1 },
  ],
  'Timeouts on slow report queries': [
    { body: 'Seen on reports over 90 days. The query scans every order instead of using the created_at index.', daysAgo: 1 },
  ],
}

/**
 * Past work sessions for a sample task, so the timer history and analytics have real rows to
 * aggregate. Finished tasks took between 70% and 140% of their estimate (varying by task, the
 * same every time); work under way has used about 40% so far. Time is split into sessions of up
 * to two hours, one a day, from 10:00 local time, on the days before the task was finished (or
 * before today).
 */
function sampleSessions(task: typeof tasks.$inferSelect, index: number, timeZone: string, today: string) {
  if (!task.estimateMinutes || task.status === 'backlog' || task.status === 'todo') {
    return []
  }
  const factor = task.status === 'done' ? 0.7 + ((index * 37) % 71) / 100 : 0.4
  let remaining = Math.round(task.estimateMinutes * factor) * 60
  // The day before it was finished, so no session runs past the moment it was marked done.
  const lastDay = addDays(task.completedAt ? dateIn(timeZone, task.completedAt) : today, -1)

  const sessions: { taskId: number, startedAt: Date, endedAt: Date }[] = []
  for (let back = 0; remaining > 0; back += 1) {
    const day = addDays(lastDay, -back)
    const tenAm = Date.parse(`${day}T10:00:00Z`) - timeZoneOffsetSeconds(timeZone, new Date(`${day}T12:00:00Z`)) * 1000
    const length = Math.min(remaining, 2 * 3600)
    // Later sessions on later hours, so a day's work doesn't all start at the same minute.
    const start = tenAm + ((index % 4) * 90) * 60_000
    sessions.push({ taskId: task.id, startedAt: new Date(start), endedAt: new Date(start + length * 1000) })
    remaining -= length
  }
  // Never in the future: an in-progress task's sessions end before now.
  return sessions.filter(session => session.endedAt.getTime() < Date.now())
}

/**
 * Sample data for a new demo workspace, so the app has something to show from the first click.
 * Dates are relative to "today" in the visitor's time zone, so deadlines stay realistic
 * whenever the demo starts.
 */
export async function seedDemoWorkspace(db: Executor, account: Account) {
  const today = dateIn(account.timezone)
  const day = (offset: number) => addDays(today, offset)
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)
  const userId = account.id

  await db.transaction(async (tx) => {
    const created = await tx
      .insert(projects)
      .values(([
        {
          name: 'Portfolio site redesign',
          description: 'New layout, case studies and a faster build for the personal site.',
          status: 'in_progress',
          priority: 'high',
          startDate: day(-20),
          deadline: day(10),
          createdAt: daysAgo(20),
        },
        {
          name: 'Mobile API v2',
          description: 'Versioned endpoints, token auth and pagination for the mobile app.',
          status: 'in_progress',
          priority: 'medium',
          startDate: day(-35),
          deadline: day(25),
          createdAt: daysAgo(35),
        },
        {
          name: 'Onboarding guide',
          description: 'A short guide for new contributors: setup, conventions and first issues.',
          status: 'planning',
          priority: 'low',
          startDate: day(5),
          deadline: day(40),
          createdAt: daysAgo(6),
        },
        {
          name: 'Billing migration',
          description: 'Move invoices and subscriptions to the new payment provider.',
          status: 'completed',
          priority: 'high',
          startDate: day(-60),
          deadline: day(-12),
          createdAt: daysAgo(60),
        },
        {
          name: 'Legacy dashboard',
          description: 'The old reporting dashboard, replaced by the new analytics.',
          status: 'completed',
          priority: 'low',
          startDate: day(-120),
          deadline: day(-70),
          archivedAt: daysAgo(30),
          createdAt: daysAgo(120),
        },
      ] as const).map(project => ({ ...project, ownerId: userId, updatedAt: project.createdAt })))
      .returning()

    const tagRows = await tx
      .insert(tags)
      .values(Object.entries(SAMPLE_TAGS).map(([name, color]) => ({ ownerId: userId, name, color })))
      .returning()
    const tagId = Object.fromEntries(tagRows.map(tag => [tag.name, tag.id]))

    const taskValues = created.flatMap((project, index) => {
      const age = Math.round((Date.now() - project.createdAt.getTime()) / 86_400_000)
      const positions: Partial<Record<TaskStatus, number>> = {}
      return SAMPLE_TASKS[index]!.map((sample) => {
        const position = positions[sample.status] ?? 0
        positions[sample.status] = position + 1
        // Created a few days before it was finished, or early in the project's life.
        const createdDaysAgo = Math.min(age, (sample.completed ?? 0) + 5)
        return {
          projectId: project.id,
          title: sample.title,
          status: sample.status,
          priority: sample.priority,
          dueDate: sample.due === undefined ? null : day(sample.due),
          estimateMinutes: sample.estimate ?? null,
          position,
          completedAt: sample.completed === undefined ? null : daysAgo(sample.completed),
          createdAt: daysAgo(createdDaysAgo),
          updatedAt: daysAgo(sample.completed ?? 1),
        }
      })
    })
    const taskRows = await tx.insert(tasks).values(taskValues).returning()
    const samples = SAMPLE_TASKS.flat()

    await tx.insert(taskTags).values(taskRows.flatMap((task, index) =>
      (samples[index]!.tags ?? []).map(name => ({ taskId: task.id, tagId: tagId[name]! }))))

    const sessionValues = taskRows.flatMap((task, index) => sampleSessions(task, index, account.timezone, today))
    if (sessionValues.length > 0) {
      await tx.insert(workSessions).values(sessionValues.map(session => ({ ...session, userId })))
    }

    const commentValues = taskRows.flatMap(task => (SAMPLE_COMMENTS[task.title] ?? [])
      .map(comment => ({ taskId: task.id, authorId: userId, body: comment.body, createdAt: daysAgo(comment.daysAgo) })))
    await tx.insert(taskComments).values(commentValues)

    const taskById = new Map(taskRows.map(task => [task.id, task]))
    await tx.insert(activityLogs).values([
      ...created.flatMap(project => [
        { userId, projectId: project.id, action: 'project.created', subject: project.name, createdAt: project.createdAt },
        ...(project.archivedAt
          ? [{ userId, projectId: project.id, action: 'project.archived', subject: project.name, createdAt: project.archivedAt }]
          : []),
      ]),
      ...taskRows.flatMap(task => [
        { userId, projectId: task.projectId, taskId: task.id, action: 'task.created', subject: task.title, createdAt: task.createdAt },
        ...(task.completedAt
          ? [{ userId, projectId: task.projectId, taskId: task.id, action: 'task.completed', subject: task.title, createdAt: task.completedAt }]
          : []),
      ]),
      ...commentValues.map(comment => ({
        userId,
        projectId: taskById.get(comment.taskId)!.projectId,
        taskId: comment.taskId,
        action: 'comment.added',
        subject: taskById.get(comment.taskId)!.title,
        createdAt: comment.createdAt,
      })),
    ])
  })
}
