<script setup lang="ts">
const { data: dashboardData, pending, error } = await useAsyncData('dashboard', () => $fetch('/audit-auto/api/dashboard'))

const stats = computed(() => [
  { label: 'Total Audits', value: dashboardData.value?.summary?.totalAudits || 0, icon: 'i-lucide-file-check', colorClass: 'text-primary' },
  { label: 'Avg Accessibility', value: `${dashboardData.value?.summary?.averageScores?.accessibility || 0}%`, icon: 'i-lucide-accessibility', colorClass: 'text-success' },
  { label: 'Avg SEO', value: `${dashboardData.value?.summary?.averageScores?.seo || 0}%`, icon: 'i-lucide-search', colorClass: 'text-info' },
  { label: 'Avg Security', value: `${dashboardData.value?.summary?.averageScores?.security || 0}%`, icon: 'i-lucide-shield', colorClass: 'text-warning' }
])

const recentAudits = computed(() => dashboardData.value?.recentAudits?.slice(0, 10) || [])

function scoreColor(score: number) {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'error'
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
          
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold">Recent Audits</h2>
                <UButton label="View All" variant="ghost" to="/audits" />
              </div>
            </template>
            
            <UTable :rows="recentAudits" :columns="[
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
