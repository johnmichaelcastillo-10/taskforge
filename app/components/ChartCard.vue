<script setup lang="ts">
// A chart with its title, an empty state, and the same numbers as a table for screen readers
// (a canvas has no text of its own).
defineProps<{
  title: string
  description?: string
  empty?: boolean
  emptyText?: string
  /** For the accessible table: column headings, then one row per data point. */
  table: { columns: string[], rows: (string | number)[][] }
  height?: string
}>()
</script>

<template>
  <!-- A column, so the chart grows to fill a card stretched by its neighbour in a grid row. -->
  <section class="flex flex-col rounded-lg border border-default p-4">
    <header class="mb-3">
      <h2 class="font-semibold">
        {{ title }}
      </h2>
      <p
        v-if="description"
        class="text-sm text-muted"
      >
        {{ description }}
      </p>
    </header>

    <div
      v-if="empty"
      class="flex flex-1 items-center justify-center rounded-md bg-elevated/40 text-sm text-muted"
      :class="height ?? 'min-h-56'"
    >
      {{ emptyText ?? 'No data for this period.' }}
    </div>
    <div
      v-else
      class="relative flex-1"
      :class="height ?? 'min-h-56'"
      aria-hidden="true"
    >
      <ClientOnly>
        <slot />
        <template #fallback>
          <USkeleton class="size-full" />
        </template>
      </ClientOnly>
    </div>

    <table
      v-if="!empty"
      class="sr-only"
    >
      <caption>{{ title }}</caption>
      <thead>
        <tr>
          <th
            v-for="column in table.columns"
            :key="column"
            scope="col"
          >
            {{ column }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in table.rows"
          :key="index"
        >
          <td
            v-for="(cell, cellIndex) in row"
            :key="cellIndex"
          >
            {{ cell }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
