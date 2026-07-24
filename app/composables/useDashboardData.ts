export function useDashboardData() {
  return useAsyncData('dashboard', () => $fetch('/audit-auto/api/dashboard'))
}

export function useTargetsData() {
  return useAsyncData('targets', () => $fetch('/audit-auto/api/targets'))
}

export function useScheduleData() {
  return useAsyncData('schedule', () => $fetch('/audit-auto/api/schedule'))
}

export function usePipelineStats() {
  return useAsyncData('pipelineStats', () => $fetch('/audit-auto/api/pipeline-stats').catch(() => null))
}

export function useSettingsData() {
  return useAsyncData('settings', () => $fetch('/audit-auto/api/settings').catch(() => null))
}
