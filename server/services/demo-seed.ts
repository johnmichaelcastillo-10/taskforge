import { activityLogs, projects, type users } from '../database/schema'
import type { Executor } from '../utils/db'

type Account = typeof users.$inferSelect

/**
 * Sample data for a new demo workspace, so the app has something to show from the first click.
 * Dates are relative to "today" in the visitor's time zone, so deadlines stay realistic
 * whenever the demo starts.
 */
export async function seedDemoWorkspace(db: Executor, account: Account) {
  const today = dateIn(account.timezone)
  const day = (offset: number) => addDays(today, offset)
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)

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
      ] as const).map(project => ({ ...project, ownerId: account.id, updatedAt: project.createdAt })))
      .returning()

    await tx.insert(activityLogs).values(created.flatMap(project => [
      { userId: account.id, projectId: project.id, action: 'project.created' as const, subject: project.name, createdAt: project.createdAt },
      ...(project.archivedAt
        ? [{ userId: account.id, projectId: project.id, action: 'project.archived' as const, subject: project.name, createdAt: project.archivedAt }]
        : []),
    ]))
  })
}
