import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { aplicarTemaEmCache } from './services/tema'
import './assets/main.css'

// Evita "flash" de tema: aplica o último tema conhecido antes de montar.
aplicarTemaEmCache()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
