<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { estado, iniciar, catalogo } from './store'
import Solicitud from './views/Solicitud.vue'
import Mantenedor from './views/Mantenedor.vue'

// Navegación simple por hash: #/ (solicitud) y #/mantenedor
const vistaDelHash = () => (location.hash.startsWith('#/mantenedor') ? 'mantenedor' : 'solicitud')
const vista = ref(vistaDelHash())
const leerHash = () => (vista.value = vistaDelHash())
onMounted(() => {
  window.addEventListener('hashchange', leerHash)
  iniciar()
})
onBeforeUnmount(() => window.removeEventListener('hashchange', leerHash))
</script>

<template>
  <nav class="nav">
    <span class="marca">Imagenología</span>
    <a href="#/" :class="{ on: vista === 'solicitud' }">Solicitud de exámenes</a>
    <a href="#/mantenedor" :class="{ on: vista === 'mantenedor' }">Mantenedor de códigos solicitables</a>
    <span class="origen" v-if="estado.listo">
      {{ catalogo.ejemplo ? 'Catálogo de ejemplo' : `${catalogo.resumen.total.toLocaleString('es-CL')} códigos en catálogo` }}
    </span>
  </nav>

  <p v-if="!estado.listo" class="cargando">Cargando…</p>
  <Mantenedor v-else-if="vista === 'mantenedor'" />
  <Solicitud v-else />
</template>

<style scoped>
.nav {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
  padding: 0 28px; background: #1b2a3d; color: #fff; min-height: 46px;
}
.marca { font-weight: 700; margin-right: 18px; letter-spacing: .02em; }
.nav a {
  color: #c9d6e8; text-decoration: none; padding: 13px 14px; font-size: .9rem; font-weight: 600;
  border-bottom: 3px solid transparent;
}
.nav a:hover { color: #fff; }
.nav a.on { color: #fff; border-bottom-color: #5aa0ff; }
.origen { margin-left: auto; font-size: .78rem; color: #9fb3cc; }
.cargando { padding: 28px; color: var(--texto-suave); }
</style>
