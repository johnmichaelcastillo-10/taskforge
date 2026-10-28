// Types only: Chart.js itself loads with components/ChartView.vue, lazily.
import type { ChartOptions } from 'chart.js'

/**
 * Chart colours for the current colour mode. Chart.js needs concrete colour strings rather than
 * CSS variables, so these mirror the Tailwind shades the rest of the UI uses.
 */
export function useChartTheme() {
  const colorMode = useColorMode()
  return computed(() => {
    const dark = colorMode.value === 'dark'
    return {
      series: dark
        ? ['#818cf8', '#2dd4bf', '#fbbf24', '#f472b6', '#38bdf8', '#a78bfa']
        : ['#4f46e5', '#0d9488', '#d97706', '#db2777', '#0284c7', '#7c3aed'],
      text: dark ? '#94a3b8' : '#64748b',
      grid: dark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(100, 116, 139, 0.15)',
    }
  })
}

/**
 * Shared axis and tooltip settings for bar and line charts; `yLabel` formats values. The legend
 * only shows with `legend: true`: a single series is already named by the chart's title.
 */
export function useAxisOptions<T extends 'bar' | 'line' = 'bar'>(options: { yLabel?: (value: number) => string, max?: number, legend?: boolean } = {}) {
  const theme = useChartTheme()
  const format = options.yLabel ?? String
  return computed<ChartOptions<T>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: options.legend ?? false, labels: { color: theme.value.text, boxWidth: 12 } },
      tooltip: {
        callbacks: {
          label: (item: { dataset: { label?: string }, parsed: { y: number } }) => `${item.dataset.label ?? ''}: ${format(item.parsed.y)}`,
        },
      },
    },
    scales: {
      x: { ticks: { color: theme.value.text, maxRotation: 0, autoSkipPadding: 12 }, grid: { display: false } },
      y: {
        beginAtZero: true,
        max: options.max,
        ticks: { color: theme.value.text, precision: 0, callback: (value: number | string) => format(Number(value)) },
        grid: { color: theme.value.grid },
      },
    },
    // The same object suits bar and line charts, but Chart.js types each chart's options apart.
  }) as unknown as ChartOptions<T>)
}

/** "Mar 4": a short label for a calendar date. */
export function shortDay(date: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00Z`))
}
