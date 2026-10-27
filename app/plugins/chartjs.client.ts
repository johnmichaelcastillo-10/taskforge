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

// Only the parts the charts use, so the rest of Chart.js stays out of the bundle. Charts render
// in the browser only (inside <ClientOnly>).
export default defineNuxtPlugin(() => {
  Chart.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip)
  Chart.defaults.font.family = 'ui-sans-serif, system-ui, sans-serif'
  Chart.defaults.maintainAspectRatio = false
})
