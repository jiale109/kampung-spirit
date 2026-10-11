import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Bootstrap is imported first so our own theme (colours, sizes, cards) can override it
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './styles/theme.css'

import App from './App.vue'
import router from './router/index.js'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
