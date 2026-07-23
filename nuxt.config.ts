// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
  
  modules: [
    '@nuxt/ui',
  ],

  app: {
    head: {
      title: 'Audit-Auto | Website Audit Dashboard',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Automated website audit system for US/EU enterprises and NGOs' },
        { name: 'theme-color', content: '#3b82f6' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/audit-auto/favicon.ico' }
      ]
    }
  },

  runtimeConfig: {
    public: {
      apiBase: '/audit-auto/api'
    }
  },

  nitro: {
    output: {
      dir: 'dist',
      publicDir: 'dist'
    }
  },

  ssr: true,

  experimental: {
    payloadExtraction: true
  }
})
