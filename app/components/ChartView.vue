<script setup lang="ts">
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'vue-chartjs'

// Every chart goes through this component, and pages load it lazily (<LazyChartView>): Chart.js
// then arrives after the page is on screen, instead of competing with it for bandwidth.
Chart.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip)
Chart.defaults.font.family = 'ui-sans-serif, system-ui, sans-serif'

defineProps<{
  type: 'bar' | 'line' | 'doughnut'
  // The shapes differ per chart type; the pages build them with useChartTheme's helpers.
  data: any // eslint-disable-line @typescript-eslint/no-explicit-any
  options: any // eslint-disable-line @typescript-eslint/no-explicit-any
}>()
</script>

<template>
  <Bar
    v-if="type === 'bar'"
    :data="data"
    :options="options"
  />
  <Line
    v-else-if="type === 'line'"
    :data="data"
    :options="options"
  />
  <Doughnut
    v-else
    :data="data"
    :options="options"
  />
</template>
