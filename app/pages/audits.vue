<script setup lang="ts">
const { data: dashboardData, pending, error } = await useAsyncData('dashboard', () => $fetch('/audit-auto/api/dashboard'))

const filter = reactive({
  type: 'all',
  region: 'all',
  minScore: 0
})

const filteredAudits = computed(() => {
  let audits = dashboardData.value?.allAudits || []
  
  if (filter.type !== 'all') {
    audits = audits.filter(a => a.type === filter.type)
  }
  if (filter.region !== 'all') {
    audits = audits.filter(a => a.region === filter.region)
  }
  if (filter.minScore > 0) {
    audits = audits.filter(a => (a.scores?.overall || 0) >= filter.minScore)
  }
  
  return audits
})

const selectedAudit = ref<any>(null)
const isModalOpen = ref(false)

function openAudit(audit: any) {
  selectedAudit.value = audit
  isModalOpen.value = true
}

function scoreColor(score: number) {
  if (score >= 80) return 'success'
  if (score >= 60) return 'warning'
  return 'error'
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Audit Results">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>
    
    <template #body>
      <div class="space-y-6">
        <UAlert v-if="error" color="error" variant="soft" title="Failed to load audits" :description="error.message" />

        <USkeleton v-else-if="pending" class="h-24" v-for="i in 4" :key="i" />

        <template v-else>
          <UCard>
            <div class="flex flex-wrap gap-4">
              <USelect v-model="filter.type" :items="[
                { label: 'All Types', value: 'all' },
                { label: 'Enterprises', value: 'enterprise' },
                { label: 'NGOs', value: 'ngo' }
              ]" />
              
              <USelect v-model="filter.region" :items="[
                { label: 'All Regions', value: 'all' },
                { label: 'US', value: 'us' },
                { label: 'EU', value: 'eu' },
                { label: 'International', value: 'international' }
              ]" />
              
              <UInput v-model.number="filter.minScore" type="number" placeholder="Min Score" min="0" max="100" />
              
              <div class="text-sm text-muted flex items-center">
                {{ filteredAudits.length }} results
              </div>
            </div>
          </UCard>
          
          <div v-if="filteredAudits.length === 0" class="text-center py-12 text-muted">
            No audits match your filters
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <UCard 
              v-for="audit in filteredAudits" 
              :key="audit.url"
              class="cursor-pointer hover:border-primary transition-colors"
              role="button"
              tabindex="0"
              @click="openAudit(audit)"
              @keydown.enter="openAudit(audit)"
            >
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="font-semibold">{{ audit.name }}</h3>
                  <p class="text-sm text-muted">{{ audit.url }}</p>
                  <div class="flex gap-2 mt-2">
                    <UBadge :color="audit.type === 'ngo' ? 'success' : 'info'" variant="subtle">
                      {{ audit.type }}
                    </UBadge>
                    <UBadge variant="subtle">{{ audit.region }}</UBadge>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-2xl font-bold" :class="{
                    'text-green-500': audit.scores?.overall >= 80,
                    'text-yellow-500': audit.scores?.overall >= 60 && audit.scores?.overall < 80,
                    'text-red-500': audit.scores?.overall < 60
                  }">
                    {{ audit.scores?.overall || 'N/A' }}
                  </div>
                  <div class="text-xs text-muted">Overall Score</div>
                </div>
              </div>
              
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                <div class="text-center">
                  <div class="text-sm font-medium">{{ audit.scores?.accessibility || '-' }}</div>
                  <div class="text-xs text-muted">A11y</div>
                </div>
                <div class="text-center">
                  <div class="text-sm font-medium">{{ audit.scores?.seo || '-' }}</div>
                  <div class="text-xs text-muted">SEO</div>
                </div>
                <div class="text-center">
                  <div class="text-sm font-medium">{{ audit.scores?.performance || '-' }}</div>
                  <div class="text-xs text-muted">Perf</div>
                </div>
                <div class="text-center">
                  <div class="text-sm font-medium">{{ audit.scores?.security || '-' }}</div>
                  <div class="text-xs text-muted">Sec</div>
                </div>
              </div>
            </UCard>
          </div>
          
          <UModal v-model:open="isModalOpen" :title="selectedAudit?.name || 'Audit Details'">
            <template #body>
              <div v-if="selectedAudit" class="space-y-4">
                <div>
                  <h4 class="font-medium mb-2">Summary</h4>
                  <p class="text-sm">{{ selectedAudit.summary || 'No summary available' }}</p>
                </div>
                
                <div v-if="selectedAudit.recommendations?.length">
                  <h4 class="font-medium mb-2">Recommendations</h4>
                  <ul class="list-disc list-inside text-sm space-y-1">
                    <li v-for="(rec, i) in selectedAudit.recommendations" :key="i">
                      {{ rec }}
                    </li>
                  </ul>
                </div>
                
                <div v-if="selectedAudit.issues && Object.keys(selectedAudit.issues).length">
                  <h4 class="font-medium mb-2">Issues</h4>
                  <div class="space-y-2">
                    <div v-for="(issues, category) in selectedAudit.issues" :key="category">
                      <div v-if="issues && issues.length > 0" class="text-sm">
                        <span class="font-medium capitalize">{{ category }}:</span>
                        <span class="text-muted ml-2">{{ issues.length }} issues found</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </UModal>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
