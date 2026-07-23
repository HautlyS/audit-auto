<script setup lang="ts">
const toast = useToast()

const { data: scheduleConfig, pending, error } = await useAsyncData('schedule', () => $fetch('/audit-auto/api/schedule'))

const config = reactive({
  cron: '0 */2 * * *',
  maxSites: 50,
  enabled: true,
  regions: ['us', 'eu'],
  categories: ['accessibility', 'seo', 'performance', 'security']
})

watchEffect(() => {
  if (scheduleConfig.value?.schedule) {
    config.cron = scheduleConfig.value.schedule.cron || config.cron
    config.maxSites = scheduleConfig.value.schedule.max_sites || config.maxSites
    config.enabled = scheduleConfig.value.schedule.enabled !== false
  }
  if (scheduleConfig.value?.regions) {
    config.regions = Object.keys(scheduleConfig.value.regions).filter(k => scheduleConfig.value.regions[k])
  }
})

const nextRun = computed(() => {
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

const saving = ref(false)

async function saveConfig() {
  saving.value = true
  try {
    await $fetch('/audit-auto/api/config', {
      method: 'POST',
      body: config
    })
    toast.add({ title: 'Configuration saved', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Failed to save configuration', color: 'error' })
  } finally {
    saving.value = false
  }
}

const { data: pipelineStats } = await useAsyncData('pipelineStats', () => $fetch('/audit-auto/api/pipeline-stats').catch(() => null))

const recentRuns = computed(() => {
  if (pipelineStats.value) {
    return [pipelineStats.value]
  }
  return []
})
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
        <UAlert v-if="error" color="error" variant="soft" title="Failed to load schedule" :description="error.message" />

        <USkeleton v-else-if="pending" class="h-24" v-for="i in 4" :key="i" />

        <template v-else>
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
                <UButton label="Save Configuration" class="w-full" :loading="saving" @click="saveConfig" />
              </template>
            </UCard>
          </div>
          
          <UCard>
            <template #header>
              <h3 class="font-medium">Recent Runs</h3>
            </template>
            
            <div v-if="recentRuns.length === 0" class="text-center py-8 text-muted">
              No pipeline runs recorded yet
            </div>
            
            <UTable v-else :rows="recentRuns" :columns="[
              { key: 'startedAt', label: 'Started' },
              { key: 'completedAt', label: 'Completed' },
              { key: 'durationFormatted', label: 'Duration' },
              { key: 'mode', label: 'Mode' }
            ]">
              <template #startedAt-data="{ row }">
                {{ new Date(row.startedAt).toLocaleString() }}
              </template>
              <template #completedAt-data="{ row }">
                {{ new Date(row.completedAt).toLocaleString() }}
              </template>
            </UTable>
          </UCard>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
