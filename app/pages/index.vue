<script setup lang="ts">
const { data: dashboardData, pending, error } = await useAsyncData('dashboard', () => $fetch('/audit-auto/api/dashboard'))

const stats = computed(() => [
  { label: 'Sites Audited', value: dashboardData.value?.summary?.totalAudits || 0, icon: 'i-lucide-file-check', colorClass: 'text-primary' },
  { label: 'Total Known', value: dashboardData.value?.summary?.totalKnownTargets || 0, icon: 'i-lucide-target', colorClass: 'text-info' },
  { label: 'Avg Score', value: `${dashboardData.value?.summary?.averageScores?.overall || 0}%`, icon: 'i-lucide-trending-up', colorClass: 'text-success' },
  { label: 'Issues Found', value: dashboardData.value?.summary?.totalIssues || 0, icon: 'i-lucide-alert-triangle', colorClass: 'text-warning' }
])

const recentAudits = computed(() => dashboardData.value?.recentAudits?.slice(0, 10) || [])
const scoreTrends = computed(() => dashboardData.value?.scoreTrends || [])

function scoreColor(score: number) {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'error'
}

function trendIcon(direction: string) {
  if (direction === 'up') return 'i-lucide-trending-up text-green-500'
  if (direction === 'down') return 'i-lucide-trending-down text-red-500'
  return 'i-lucide-minus text-muted'
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Dashboard">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>
    
    <template #body>
      <div class="space-y-6">
        <UAlert v-if="error" color="error" variant="soft" title="Failed to load dashboard" :description="error.message" />
        <USkeleton v-else-if="pending" class="h-24" v-for="i in 4" :key="i" />

        <template v-else>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <UCard v-for="stat in stats" :key="stat.label">
              <div class="flex items-center gap-4">
                <UIcon :name="stat.icon" class="text-2xl" :class="stat.colorClass" />
                <div>
                  <div class="text-2xl font-bold">{{ stat.value }}</div>
                  <div class="text-sm text-muted">{{ stat.label }}</div>
                </div>
              </div>
            </UCard>
          </div>

          <div v-if="scoreTrends.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h2 class="text-lg font-semibold">Score Trends</h2>
                </div>
              </template>
              <div class="space-y-2">
                <div v-for="trend in scoreTrends.slice(0, 5)" :key="trend.url"
                  class="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                  <div class="flex items-center gap-2">
                    <UIcon :name="trendIcon(trend.direction)" class="text-lg" />
                    <span class="text-sm font-medium">{{ trend.name }}</span>
                  </div>
                  <div class="flex items-center gap-3 text-sm">
                    <span class="text-muted">{{ trend.firstScore }}%</span>
                    <span class="text-muted">→</span>
                    <span :class="trend.direction === 'up' ? 'text-green-500' : 'text-red-500'" class="font-medium">
                      {{ trend.currentScore }}%
                    </span>
                    <span :class="trend.change > 0 ? 'text-green-500' : 'text-red-500'" class="text-xs">
                      ({{ trend.change > 0 ? '+' : '' }}{{ trend.change }})
                    </span>
                    <span class="text-xs text-muted">{{ trend.auditCount }} audits</span>
                  </div>
                </div>
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h2 class="text-lg font-semibold">Pipeline Insights</h2>
                </div>
              </template>
              <div class="space-y-3">
                <div class="flex justify-between text-sm">
                  <span class="text-muted">Unique sites tracked</span>
                  <span class="font-medium">{{ dashboardData?.summary?.totalTargetsInRegistry }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-muted">Sites with score history</span>
                  <span class="font-medium">{{ dashboardData?.summary?.uniqueSitesWithHistory }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-muted">Known targets in registry</span>
                  <span class="font-medium">{{ dashboardData?.summary?.totalKnownTargets }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-muted">Total issues across all sites</span>
                  <span class="font-medium">{{ dashboardData?.summary?.totalIssues }}</span>
                </div>
                <UButton label="View Registry" variant="outline" class="w-full mt-2" to="/targets" />
              </div>
            </UCard>
          </div>

          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold">Latest Audits</h2>
                <UButton label="View All" variant="ghost" to="/audits" />
              </div>
            </template>
            <div v-if="recentAudits.length === 0" class="text-center py-8 text-muted">
              No audits yet. Pipeline runs every 2 hours.
            </div>
            <UTable v-else :rows="recentAudits" :columns="[
              { key: 'name', label: 'Name' },
              { key: 'type', label: 'Type' },
              { key: 'region', label: 'Region' },
              { key: 'scores.overall', label: 'Score' },
              { key: 'timestamp', label: 'Date' }
            ]">
              <template #scores-overall-data="{ row }">
                <UBadge :color="scoreColor(row.scores?.overall || 0)" variant="subtle">
                  {{ row.scores?.overall || 'N/A' }}
                </UBadge>
              </template>
              <template #timestamp-data="{ row }">
                {{ new Date(row.timestamp).toLocaleDateString() }}
              </template>
            </UTable>
          </UCard>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
