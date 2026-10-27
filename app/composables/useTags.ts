/** The user's tags, shared by every component that shows or picks them. */
export function useTags() {
  const { data, refresh } = useFetch('/api/tags', { key: 'tags', default: () => ({ tags: [] as Tag[] }) })
  const tags = computed<Tag[]>(() => data.value?.tags ?? [])
  const byId = computed(() => new Map(tags.value.map(tag => [tag.id, tag])))

  /** Creates a tag, picking a colour from its name so the same word always looks the same. */
  async function createTag(name: string): Promise<Tag> {
    const hash = [...name.toLowerCase()].reduce((sum, char) => sum + char.charCodeAt(0), 0)
    const color = TAG_COLORS[hash % TAG_COLORS.length]
    const { tag } = await $fetch<{ tag: Tag }>('/api/tags', { method: 'POST', body: { name, color } })
    await refresh()
    return tag
  }

  return { tags, byId, refresh, createTag }
}
