<script setup lang="ts">
const toast = useToast()

const settings = reactive({
  opencode: {
    model: 'opencode/grok-code',
    apiKey: ''
  },
  github: {
    repository: 'hautlys/autit-auto',
    branch: 'main'
  },
  notifications: {
    email: true,
    slack: false
  }
})

const saving = ref(false)

async function saveSettings() {
  saving.value = true
  try {
    await $fetch('/api/settings', {
      method: 'POST',
      body: settings
    })
    toast.add({ title: 'Settings saved successfully', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Failed to save settings', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Settings">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>
    
    <template #body>
      <div class="space-y-6">
        <!-- OpenCode Configuration -->
        <UCard>
          <template #header>
            <h3 class="font-medium">OpenCode Configuration</h3>
          </template>
          
          <div class="space-y-4">
            <div>
              <label class="text-sm font-medium">Model</label>
              <UInput v-model="settings.opencode.model" placeholder="opencode/grok-code" />
              <p class="text-xs text-muted mt-1">Free tier: opencode/grok-code</p>
            </div>
            
            <div>
              <label class="text-sm font-medium">API Key (Optional for free tier)</label>
              <UInput v-model="settings.opencode.apiKey" type="password" placeholder="sk-..." />
            </div>
          </div>
        </UCard>
        
        <!-- GitHub Configuration -->
        <UCard>
          <template #header>
            <h3 class="font-medium">GitHub Configuration</h3>
          </template>
          
          <div class="space-y-4">
            <div>
              <label class="text-sm font-medium">Repository</label>
              <UInput v-model="settings.github.repository" placeholder="owner/repo" />
            </div>
            
            <div>
              <label class="text-sm font-medium">Branch</label>
              <UInput v-model="settings.github.branch" placeholder="main" />
            </div>
          </div>
        </UCard>
        
        <!-- Notifications -->
        <UCard>
          <template #header>
            <h3 class="font-medium">Notifications</h3>
          </template>
          
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <USwitch v-model="settings.notifications.email" />
              <label class="text-sm font-medium">Email notifications</label>
            </div>
            <div class="flex items-center gap-2">
              <USwitch v-model="settings.notifications.slack" />
              <label class="text-sm font-medium">Slack notifications</label>
            </div>
          </div>
        </UCard>
        
        <!-- Save Button -->
        <div class="flex justify-end">
          <UButton label="Save Settings" :loading="saving" @click="saveSettings" />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
