import { createProject } from '../../services/projects'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const input = await readValidBody(event, projectCreateSchema)
  setResponseStatus(event, 201)
  return { project: await createProject(await useDb(), account.id, input) }
})
