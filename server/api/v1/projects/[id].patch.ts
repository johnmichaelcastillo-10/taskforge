import { updateProject } from '../../../services/projects'

/** Edits fields, or archives (`archived: true`) and restores (`archived: false`) the project. */
export default defineEventHandler(async (event) => {
  const account = await requireApiAccount(event)
  const id = routeId(event)
  const input = await readValidBody(event, projectUpdateSchema)
  return { project: await updateProject(await useDb(), account.id, id, input) }
})
