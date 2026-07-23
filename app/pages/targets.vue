<script setup lang="ts">
const { data: targets } = await useFetch('/api/targets')

const filter = reactive({
  type: 'all',
  region: 'all',
  search: ''
})

const filteredTargets = computed(() => {
  let list = targets.value || []
  
  if (filter.type !== 'all') {
    list = list.filter(t => t.type === filter.type)
  }
  if (filter.region !== 'all') {
    list = list.filter(t => t.region === filter.region)
  }
  if (filter.search) {
    const s = filter.search.toLowerCase()
    list = list.filter(t => t.name.toLowerCase().includes(s) || t.url.toLowerCase().includes(s))
  }
  
  return list
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Audit Targets">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>
    
    <template #body>
      <div class="space-y-6">
        <!-- Filters -->
        <UCard>
          <div class="flex flex-wrap gap-4">
            <UInput v-model="filter.search" placeholder="Search targets..." icon="i-lucide-search" class="w-64" />
            
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
          </div>
        </UCard>
        
        <!-- Stats -->
        <div class="grid grid-cols-3 gap-4">
          <UCard>
            <div class="text-center">
              <div class="text-2xl font-bold">{{ filteredTargets.length }}</div>
              <div class="text-sm text-muted">Total Targets</div>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <div class="text-2xl font-bold">{{ filteredTargets.filter(t => t.type === 'enterprise').length }}</div>
              <div class="text-sm text-muted">Enterprises</div>
            </div>
          </UCard>
          <UCard>
            <div class="text-center">
              <div class="text-2xl font-bold">{{ filteredTargets.filter(t => t.type === 'ngo').length }}</div>
              <div class="text-sm text-muted">NGOs</div>
            </div>
          </UCard>
        </div>
        
        <!-- Targets Table -->
        <UCard>
          <UTable :rows="filteredTargets" :columns="[
            { key: 'name', label: 'Name' },
            { key: 'url', label: 'URL' },
            { key: 'type', label: 'Type' },
            { key: 'region', label: 'Region' },
            { key: 'category', label: 'Category' }
          ]">
            <template #url-data="{ row }">
              <a :href="row.url" target="_blank" class="text-primary hover:underline">
                {{ row.url }}
              </a>
            </template>
            <template #type-data="{ row }">
              <UBadge :color="row.type === 'ngo' ? 'success' : 'info'" variant="subtle">
                {{ row.type }}
              </UBadge>
            </template>
          </UTable>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
