<script setup lang="ts">
const { data: scheduleConfig } = await useFetch('/api/schedule')

const config = reactive({
  cron: '0 */2 * * *',
  maxSites: 50,
  enabled: true,
  regions: ['us', 'eu'],
  categories: ['accessibility', 'seo', 'performance', 'security']
})

const nextRun = computed(() => {
  // Calculate next run based on cron
  const now = new Date()
  const hours = now.getHours()
  const nextHour = Math.ceil((hours + 1) / 2) * 2
  const next = new Date(now)
  next.setHours(nextHour % 24, 0, 0, 0)
  if (nextHour >= 24) {
    next.setDate(next.getDate() + 1)
  }
  return next
})

const recentRuns = ref([
  { id: 1, timestamp: new Date(Date.now() - 7200000).toISOString(), status: 'success', sitesAudited: 47, duration: '12m 34s' },
  { id: 2, timestamp: new Date(Date.now() - 14400000).toISOString(), status: 'success', sitesAudited: 50, duration: '13m 02s' },
  { id: 3, timestamp: new Date(Date.now() - 21600000).toISOString(), status: 'partial', sitesAudited: 35, duration: '10m 15s' },
  { id: 4, timestamp: new Date(Date.now() - 28800000).toISOString(), status: 'success', sitesAudited: 50, duration: '14m 22s' },
])
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Schedule Configuration">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>
    
    <template #body>
      <div class="space-y-6">
        <!-- Schedule Status -->
        <UCard>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold">Next Scheduled Run</h2>
              <p class="text-muted">{{ nextRun.toLocaleString() }}</p>
            </div>
            <UBadge :color="config.enabled ? 'success' : 'error'" size="lg">
              {{ config.enabled ? 'Active' : 'Disabled' }}
            </UBadge>
          </div>
        </UCard>
        
        <!-- Configuration -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <h3 class="font-medium">Schedule Settings</h3>
            </template>
            
            <div class="space-y-4">
              <div>
                <label class="text-sm font-medium">Cron Expression</label>
                <UInput v-model="config.cron" placeholder="0 */2 * * *" />
                <p class="text-xs text-muted mt-1">Current: Every 2 hours</p>
              </div>
              
              <div>
                <label class="text-sm font-medium">Max Sites per Run</label>
                <UInput v-model.number="config.maxSites" type="number" min="1" max="100" />
              </div>
              
              <div class="flex items-center gap-2">
                <USwitch v-model="config.enabled" />
                <label class="text-sm font-medium">Enable Schedule</label>
              </div>
            </div>
          </UCard>
          
          <UCard>
            <template #header>
              <h3 class="font-medium">Target Regions</h3>
            </template>
            
            <div class="space-y-2">
              <UCheckbox v-model="config.regions" value="us" label="United States" />
              <UCheckbox v-model="config.regions" value="eu" label="Europe" />
              <UCheckbox v-model="config.regions" value="international" label="International" />
            </div>
            
            <template #footer>
              <UButton label="Save Configuration" class="w-full" />
            </template>
          </UCard>
        </div>
        
        <!-- Recent Runs -->
        <UCard>
          <template #header>
            <h3 class="font-medium">Recent Runs</h3>
          </template>
          
          <UTable :rows="recentRuns" :columns="[
            { key: 'timestamp', label: 'Time' },
            { key: 'status', label: 'Status' },
            { key: 'sitesAudited', label: 'Sites' },
            { key: 'duration', label: 'Duration' }
          ]">
            <template #timestamp-data="{ row }">
              {{ new Date(row.timestamp).toLocaleString() }}
            </template>
            <template #status-data="{ row }">
              <UBadge :color="row.status === 'success' ? 'success' : 'warning'" variant="subtle">
                {{ row.status }}
              </UBadge>
            </template>
          </UTable>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
