<script setup>
import { ref, computed } from 'vue'
import {
  insumos, estado, catalogo, config, sesion, habilitadosPorSede,
  cargarInsumoOCL, cargarInsumoPlaybook, quitarInsumo,
  agregarSede, eliminarSede, copiarHabilitados, agregarPerfil, eliminarPerfil, codigosSoloDePerfil,
  exportarConfig, importarConfig, restablecerConfig
} from '../store'
import { ZIPS_OCL, CSV_PLAYBOOK } from '../utils/cargarCatalogo'
import TablaCodigos from '../components/TablaCodigos.vue'

const fmt = (n) => (n ?? 0).toLocaleString('es-CL')
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-CL') : '')

// ---- Fuentes de datos ----
const zipElegido = ref(ZIPS_OCL[0].archivo)
const inputZip = ref(null)
const inputCsv = ref(null)
const aviso = ref('')

async function cargarZip(origen) {
  const r = await cargarInsumoOCL(origen)
  if (r) aviso.value = `${r.meta.tipo === 'coleccion' ? 'Collection' : 'Fuente'} «${r.meta.nombre}» cargada: ${fmt(r.conceptos.length)} conceptos`
}
async function cargarCsv(origen) {
  const r = await cargarInsumoPlaybook(origen)
  if (r) aviso.value = `Radiology Playbook ${r.version ?? ''} cargado: ${fmt(Object.keys(r.loinc).length)} términos LOINC`
}
function elegido(ev, accion) {
  const archivo = ev.target.files?.[0]
  ev.target.value = ''
  if (archivo) accion(archivo)
}

const fuente = computed(() => insumos.value.fuente)
const coleccion = computed(() => insumos.value.coleccion)
const playbook = computed(() => insumos.value.playbook)

// ---- Sedes ----
if (!config.sedes.some((s) => s.id === sesion.sedeMantenedor)) sesion.sedeMantenedor = config.sedes[0]?.id ?? null
const nuevaSede = ref('')
function crearSede() {
  const id = agregarSede(nuevaSede.value)
  if (id) {
    sesion.sedeMantenedor = id
    nuevaSede.value = ''
  }
}
function borrarSede(s) {
  const n = habilitadosPorSede.value[s.id]?.size ?? 0
  if (!confirm(`¿Eliminar la sede «${s.nombre}»${n ? ` y sus ${fmt(n)} códigos habilitados` : ''}?`)) return
  eliminarSede(s.id)
  if (sesion.sedeMantenedor === s.id) sesion.sedeMantenedor = config.sedes[0]?.id ?? null
}
const copiarDesde = ref('')
function copiar() {
  if (!copiarDesde.value || !sesion.sedeMantenedor) return
  const n = habilitadosPorSede.value[copiarDesde.value]?.size ?? 0
  if (confirm(`Se reemplazarán los códigos habilitados de esta sede por los ${fmt(n)} de la otra sede. ¿Continuar?`))
    copiarHabilitados(copiarDesde.value, sesion.sedeMantenedor)
  copiarDesde.value = ''
}

// Habilitados por sede, contando solo los códigos del catálogo actual
const habilitadosEnCatalogo = computed(() => {
  const c = {}
  for (const s of config.sedes) {
    const set = habilitadosPorSede.value[s.id]
    c[s.id] = set?.size ? catalogo.value.examenes.reduce((n, e) => n + set.has(e.id), 0) : 0
  }
  return c
})

// ---- Perfiles ----
const nuevoPerfil = ref('')
function crearPerfil() {
  if (agregarPerfil(nuevoPerfil.value)) nuevoPerfil.value = ''
}
const usoPerfil = computed(() => {
  const c = {}
  for (const ps of Object.values(config.restricciones)) for (const p of ps) c[p] = (c[p] || 0) + 1
  return c
})
function borrarPerfil(p) {
  const abiertos = codigosSoloDePerfil(p.id).length
  const msg = abiertos
    ? `¿Eliminar el perfil «${p.nombre}»? ${fmt(abiertos)} código(s) restringidos solo a este perfil quedarán disponibles para todos los perfiles.`
    : `¿Eliminar el perfil «${p.nombre}»?`
  if (confirm(msg)) eliminarPerfil(p.id)
}

// ---- Configuración ----
const inputConfig = ref(null)
async function importar(ev) {
  const archivo = ev.target.files?.[0]
  ev.target.value = ''
  if (!archivo) return
  try {
    await importarConfig(archivo)
    aviso.value = 'Configuración importada'
  } catch (err) {
    estado.error = err.message
  }
}
function restablecer() {
  if (confirm('Se borrarán todas las sedes, perfiles, habilitaciones y restricciones. ¿Continuar?')) restablecerConfig()
}
</script>

<template>
  <header class="barra">
    <div>
      <h1>Mantenedor de códigos solicitables</h1>
      <p>Cargue el catálogo desde OCL y el Radiology Playbook, habilite códigos por sede y restrinja los que solo pueden pedir ciertos perfiles profesionales.</p>
    </div>
    <div class="acciones-config">
      <button class="btn secundario" @click="exportarConfig">Exportar configuración</button>
      <button class="btn secundario" @click="inputConfig.click()">Importar…</button>
      <button class="btn texto" @click="restablecer">Restablecer</button>
      <input ref="inputConfig" type="file" accept=".json,application/json" hidden @change="importar" />
    </div>
  </header>

  <main class="mant">
    <!-- Fuentes de datos -->
    <section class="card fuentes">
      <h2>1 · Fuentes de datos</h2>
      <div class="fuentes-grid">
        <div class="bloque">
          <h3>Catálogo OCL <small>fuente o collection</small></h3>
          <div class="fila">
            <select v-model="zipElegido" :disabled="!!estado.cargando">
              <option v-for="z in ZIPS_OCL" :key="z.archivo" :value="z.archivo">{{ z.etiqueta }}</option>
            </select>
            <button class="btn" :disabled="!!estado.cargando" @click="cargarZip(zipElegido)">
              <span v-if="estado.cargando === 'ocl'" class="spinner" aria-hidden="true"></span>
              {{ estado.cargando === 'ocl' ? 'Cargando…' : 'Cargar desde la carpeta' }}
            </button>
            <button class="btn secundario" :disabled="!!estado.cargando" @click="inputZip.click()">Otro archivo…</button>
            <input ref="inputZip" type="file" accept=".zip" hidden @change="elegido($event, cargarZip)" />
          </div>
          <dl class="insumos">
            <div>
              <dt>Fuente</dt>
              <dd v-if="fuente">
                <strong>{{ fuente.meta.nombre }}</strong> · {{ fuente.meta.codigo }} {{ fuente.meta.version }} · {{ fuente.meta.organizacion }}
                <small>{{ fmt(fuente.conceptos.length) }} conceptos · {{ fecha(fuente.meta.fecha) }}</small>
                <button class="link" @click="quitarInsumo('fuente')">Quitar</button>
              </dd>
              <dd v-else class="vacio">Sin cargar: aporta los mapeos a LOINC y el código local de cada concepto.</dd>
            </div>
            <div>
              <dt>Collection</dt>
              <dd v-if="coleccion">
                <strong>{{ coleccion.meta.nombre }}</strong> · {{ coleccion.meta.codigo }} {{ coleccion.meta.version }} · {{ coleccion.meta.organizacion }}
                <small>
                  {{ fmt(coleccion.conceptos.length) }} conceptos de {{ coleccion.meta.origen.join(', ') }} · {{ fecha(coleccion.meta.fecha) }}
                </small>
                <small v-if="catalogo.resumen.sinFuente" class="alerta">
                  {{ fmt(catalogo.resumen.sinFuente) }} conceptos no están en la fuente cargada: quedan sin LOINC ni atributos.
                </small>
                <button class="link" @click="quitarInsumo('coleccion')">Quitar</button>
              </dd>
              <dd v-else class="vacio">Opcional: si se carga, el catálogo se limita a sus conceptos.</dd>
            </div>
          </dl>
        </div>

        <div class="bloque">
          <h3>Radiology Playbook LOINC/RSNA <small>CSV</small></h3>
          <div class="fila">
            <button class="btn" :disabled="!!estado.cargando" :title="CSV_PLAYBOOK" @click="cargarCsv(CSV_PLAYBOOK)">
              <span v-if="estado.cargando === 'playbook'" class="spinner" aria-hidden="true"></span>
              {{ estado.cargando === 'playbook' ? 'Cargando…' : 'Cargar CSV de la carpeta' }}
            </button>
            <button class="btn secundario" :disabled="!!estado.cargando" @click="inputCsv.click()">Otro archivo…</button>
            <input ref="inputCsv" type="file" accept=".csv,text/csv" hidden @change="elegido($event, cargarCsv)" />
          </div>
          <code class="ruta">{{ CSV_PLAYBOOK }}</code>
          <dl class="insumos">
            <div>
              <dt>Playbook</dt>
              <dd v-if="playbook">
                <strong>LOINC {{ playbook.version ?? '(versión no indicada)' }}</strong>
                <small>{{ fmt(Object.keys(playbook.loinc).length) }} términos · {{ fmt(Object.keys(playbook.partes).length) }} LOINC Parts</small>
                <button class="link" @click="quitarInsumo('playbook')">Quitar</button>
              </dd>
              <dd v-else class="vacio">Sin cargar: aporta los filtros adicionales (foco anatómico, contraste, procedimiento…).</dd>
            </div>
          </dl>
        </div>
      </div>

      <p class="resultado">
        <template v-if="catalogo.ejemplo">Sin catálogo OCL: se usa el <strong>catálogo de ejemplo</strong> ({{ fmt(catalogo.resumen.total) }} códigos).</template>
        <template v-else>
          Catálogo: <strong>{{ fmt(catalogo.resumen.total) }} códigos</strong>
          {{ coleccion ? `(collection ${coleccion.meta.codigo})` : `(fuente ${fuente?.meta.codigo})` }}
          <template v-if="playbook"> · {{ fmt(catalogo.resumen.enPlaybook) }} cruzados con el Playbook por código LOINC</template>
        </template>
      </p>
      <p v-if="estado.error" class="error">{{ estado.error }}</p>
      <p v-else-if="aviso" class="ok">{{ aviso }}</p>
    </section>

    <!-- Sedes y perfiles -->
    <div class="dos">
      <section class="card">
        <h2>2 · Sedes</h2>
        <ul class="lista">
          <li v-for="s in config.sedes" :key="s.id" :class="{ activa: sesion.sedeMantenedor === s.id }">
            <input type="radio" name="sede" :value="s.id" v-model="sesion.sedeMantenedor" :aria-label="`Configurar ${s.nombre}`" />
            <input class="nombre" v-model.lazy="s.nombre" :aria-label="`Nombre de la sede ${s.nombre}`" />
            <span class="cuenta">{{ fmt(habilitadosEnCatalogo[s.id]) }} habilitados</span>
            <button class="quitar" title="Eliminar sede" @click="borrarSede(s)">×</button>
          </li>
        </ul>
        <form class="agregar" @submit.prevent="crearSede">
          <input v-model="nuevaSede" placeholder="Nueva sede…" />
          <button class="btn secundario" :disabled="!nuevaSede.trim()">Agregar</button>
        </form>
        <div v-if="config.sedes.length > 1" class="copiar">
          <select v-model="copiarDesde">
            <option value="">Copiar habilitados desde otra sede…</option>
            <option v-for="s in config.sedes.filter((x) => x.id !== sesion.sedeMantenedor)" :key="s.id" :value="s.id">
              {{ s.nombre }} ({{ fmt(habilitadosEnCatalogo[s.id]) }})
            </option>
          </select>
          <button class="btn secundario" :disabled="!copiarDesde" @click="copiar">Copiar</button>
        </div>
      </section>

      <section class="card">
        <h2>3 · Perfiles profesionales</h2>
        <ul class="lista perfiles">
          <li v-for="p in config.perfiles" :key="p.id">
            <input class="nombre" v-model.lazy="p.nombre" :aria-label="`Nombre del perfil ${p.nombre}`" />
            <span class="cuenta" :title="'Códigos restringidos que este perfil puede solicitar'">{{ fmt(usoPerfil[p.id]) }} restringidos</span>
            <button class="quitar" title="Eliminar perfil" @click="borrarPerfil(p)">×</button>
          </li>
        </ul>
        <form class="agregar" @submit.prevent="crearPerfil">
          <input v-model="nuevoPerfil" placeholder="Nuevo perfil…" />
          <button class="btn secundario" :disabled="!nuevoPerfil.trim()">Agregar</button>
        </form>
      </section>
    </div>

    <!-- Códigos -->
    <section class="card">
      <h2>4 · Códigos solicitables</h2>
      <p v-if="!config.sedes.length" class="vacio">Agregue una sede para habilitar códigos.</p>
      <TablaCodigos v-else />
    </section>
  </main>
</template>

<style scoped>
.barra { padding: 20px 28px 8px; display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: flex-start; }
.barra h1 { margin: 0; font-size: 1.4rem; }
.barra p { margin: 4px 0 0; color: var(--texto-suave); font-size: .9rem; max-width: 720px; }
.acciones-config { display: flex; gap: 8px; align-items: center; }
.mant { display: grid; gap: 18px; padding: 16px 28px 40px; }
@media (max-width: 720px) { .mant { padding: 12px; } }
h2 { margin: 0 0 14px; font-size: 1rem; }
h3 { margin: 0 0 10px; font-size: .9rem; }
h3 small { font-weight: 500; color: var(--texto-suave); }

.fuentes-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 18px; }
.bloque { border: 1px solid var(--borde); border-radius: 10px; padding: 14px; background: var(--fondo); }
.fila { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.fila select { flex: 1 1 260px; padding: 8px 10px; border: 1.5px solid var(--borde); border-radius: 8px; background: var(--superficie); font-size: .85rem; }
.ruta { display: block; margin-top: 8px; font-size: .72rem; color: var(--texto-suave); word-break: break-all; }
.insumos { margin: 12px 0 0; display: grid; gap: 8px; }
.insumos > div { display: grid; grid-template-columns: 82px 1fr; gap: 8px; }
.insumos dt { font-size: .78rem; font-weight: 700; color: var(--texto-suave); padding-top: 2px; }
.insumos dd { margin: 0; font-size: .85rem; display: grid; gap: 2px; justify-items: start; }
.insumos small { color: var(--texto-suave); font-size: .78rem; }
.insumos .alerta { color: #a8650a; }
.vacio { color: var(--texto-suave); font-size: .85rem; }
.resultado { margin: 14px 0 0; font-size: .9rem; }
.error { margin: 8px 0 0; color: #b23b3b; font-size: .85rem; }
.ok { margin: 8px 0 0; color: #0f8a6c; font-size: .85rem; }

.dos { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 18px; align-items: start; }
.lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; max-height: 300px; overflow-y: auto; }
.lista li { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 8px; }
.lista li.activa { background: var(--primario-suave); }
.nombre { flex: 1; min-width: 0; border: 1px solid transparent; background: transparent; padding: 5px 7px; border-radius: 6px; font-size: .88rem; color: var(--texto); }
.nombre:hover { border-color: var(--borde); }
.nombre:focus { outline: none; border-color: var(--primario); background: var(--superficie); }
.cuenta { font-size: .75rem; color: var(--texto-suave); white-space: nowrap; }
.quitar { border: 0; background: none; font-size: 1.15rem; color: var(--texto-suave); cursor: pointer; line-height: 1; }
.quitar:hover { color: #c0392b; }
.agregar, .copiar { display: flex; gap: 8px; margin-top: 10px; }
.agregar input, .copiar select { flex: 1; padding: 8px 10px; border: 1.5px solid var(--borde); border-radius: 8px; font-size: .85rem; background: var(--superficie); }

.btn { border: 0; background: var(--primario); color: #fff; padding: 8px 14px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: .85rem; white-space: nowrap; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn.secundario { background: var(--superficie); color: var(--texto); border: 1px solid var(--borde); }
.btn.texto { background: none; color: #b23b3b; padding: 8px 6px; }
.link { border: 0; background: none; color: var(--primario); cursor: pointer; font-size: .8rem; text-decoration: underline; padding: 0; }
.spinner {
  display: inline-block; width: 12px; height: 12px; margin-right: 6px; vertical-align: -1px;
  border: 2px solid rgba(255,255,255,.5); border-top-color: #fff; border-radius: 50%; animation: giro .8s linear infinite;
}
@keyframes giro { to { transform: rotate(360deg); } }
</style>
