<script setup lang="ts">
const route = useRoute()

const links = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Audits', icon: 'i-lucide-file-search', to: '/audits' },
  { label: 'Targets', icon: 'i-lucide-globe', to: '/targets' },
  { label: 'Schedule', icon: 'i-lucide-calendar', to: '/schedule' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' }
]
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar>
      <template #header>
        <NuxtLink to="/" class="flex items-center gap-2">
          <span class="text-xl font-bold">Audit-Auto</span>
        </NuxtLink>
      </template>
      
      <UNavigationMenu :links="links" />
      
      <template #footer>
        <div class="text-sm text-muted">
          v1.0.0 | Every 2h
        </div>
      </template>
    </UDashboardSidebar>
    
    <slot />
  </UDashboardGroup>
</template>
