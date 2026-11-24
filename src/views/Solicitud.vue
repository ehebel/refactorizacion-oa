<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { LADOS, LP } from '../data/loinc.js'
import { filtrarExamenes, requiereLado, conteoPorEje } from '../utils/filtros'
import { catalogo as cat, vocabulario, config, sesion, habilitadosPorSede, puedeSolicitar } from '../store'
import ExamSearch from '../components/ExamSearch.vue'
import BodyFigure from '../components/BodyFigure.vue'

// ---- Sede y perfil profesional de quien solicita ----
const sedes = computed(() => config.sedes)
const perfiles = computed(() => config.perfiles)
if (!sedes.value.some((s) => s.id === sesion.sedeSolicitud)) sesion.sedeSolicitud = sedes.value[0]?.id ?? null
if (sesion.perfilSolicitud && !perfiles.value.some((p) => p.id === sesion.perfilSolicitud)) sesion.perfilSolicitud = null

// Catálogo solicitable: códigos habilitados en la sede y permitidos para el perfil
const habilitadosSede = computed(() => habilitadosPorSede.value[sesion.sedeSolicitud] ?? new Set())
const enRedLista = computed(() =>
  cat.value.examenes.filter((e) => habilitadosSede.value.has(e.id) && puedeSolicitar(e.id, sesion.perfilSolicitud))
)
const enRed = computed(() => new Set(enRedLista.value.map((e) => e.id)))

// «Ver catálogo completo»: muestra todo el catálogo, sin restricciones de sede ni perfil.
// Lo que queda fuera de la red se marca en naranjo y pide confirmación al agregarlo.
const catalogoCompleto = ref(false)
const catalogo = computed(() => (catalogoCompleto.value ? cat.value.examenes : enRedLista.value))
const fueraDeRedIds = computed(() =>
  catalogoCompleto.value ? new Set(cat.value.examenes.filter((e) => !enRed.value.has(e.id)).map((e) => e.id)) : new Set()
)
// Habilitados en la sede que el perfil elegido no puede solicitar
const restringidosPerfil = computed(
  () => cat.value.examenes.filter((e) => habilitadosSede.value.has(e.id) && !puedeSolicitar(e.id, sesion.perfilSolicitud)).length
)
const nombreSede = computed(() => sedes.value.find((s) => s.id === sesion.sedeSolicitud)?.nombre ?? '')

// Al cambiar de sede o perfil se descarta lo que ya no es solicitable en la red
// (los aceptados como «fuera de red» se mantienen; si pasan a estar en la red, pierden la marca)
watch(enRed, (ids) => {
  const antes = seleccionados.value.length
  seleccionados.value = seleccionados.value
    .filter((s) => s.fueraDeRed || ids.has(s.id))
    .map((s) => (s.fueraDeRed && ids.has(s.id) ? { ...s, fueraDeRed: false } : s))
  if (seleccionados.value.length < antes) mostrarAviso('Se quitaron exámenes que no son solicitables con la sede o el perfil elegidos')
})

const nombres = computed(() => vocabulario.value.nombres)
const modPorCodigo = computed(() => Object.fromEntries(vocabulario.value.modalidades.map((m) => [m.codigo, m])))
const nombresLista = (codigos) => codigos.map((c) => nombres.value[c] ?? c).join(', ')

// ---- Filtros (compartidos entre los selectores y la figura humana) ----
const modalidades = ref([])
const parte = ref(null)
const lateralidad = ref(null)
const extras = ref({}) // filtros adicionales del Playbook: { eje: códigoLP }
const filtros = computed(() => ({
  modalidades: modalidades.value,
  parte: parte.value,
  lateralidad: lateralidad.value,
  extras: extras.value
}))

const candidatos = computed(() => filtrarExamenes(catalogo.value, filtros.value))

// Nº de exámenes por opción de cada filtro del Playbook (con los demás filtros aplicados)
const conteoEjes = computed(() => conteoPorEje(catalogo.value, filtros.value, vocabulario.value.ejes))

// Nº de exámenes por parte según las modalidades (para atenuar zonas vacías en la figura)
const conteoParte = computed(() => {
  const base = filtrarExamenes(catalogo.value, { modalidades: modalidades.value, extras: extras.value })
  const partes = [...vocabulario.value.partes.map((p) => p.codigo), LP.EXTREMITY, LP.WHOLE_BODY]
  return Object.fromEntries(partes.map((p) => [p, filtrarExamenes(base, { parte: p }).length]))
})

// Nº de exámenes por lateralidad según modalidades y parte (botones bajo la figura)
const conteoLat = computed(() => {
  const base = filtrarExamenes(catalogo.value, { modalidades: modalidades.value, parte: parte.value, extras: extras.value })
  return Object.fromEntries(
    vocabulario.value.lateralidades.map((l) => [l.codigo, filtrarExamenes(base, { lateralidad: l.codigo }).length])
  )
})

// Nº de exámenes por modalidad según parte y lateralidad (número pequeño en cada óvalo)
const conteoModalidad = computed(() => {
  const c = {}
  for (const e of filtrarExamenes(catalogo.value, { parte: parte.value, lateralidad: lateralidad.value, extras: extras.value }))
    for (const m of e.modalidades) c[m] = (c[m] || 0) + 1
  return c
})

// ---- Exámenes seleccionados ----
const seleccionados = ref([])
const agregados = computed(() => new Set(seleccionados.value.map((s) => s.id)))
const aviso = ref('')
let uid = 0

function agregar(examen) {
  // Un examen "Unilateral" requiere indicar el lado; se toma del filtro si es Left/Right
  const pideLado = requiereLado(examen)
  const lado = pideLado ? (LADOS.includes(lateralidad.value) ? lateralidad.value : '') : null
  if (!pideLado && agregados.value.has(examen.id)) {
    mostrarAviso(`«${examen.nombre}» ya está en la solicitud`)
    return
  }
  const item = { ...examen, pideLado, lado, fueraDeRed: !enRed.value.has(examen.id) }
  // Fuera de la red: se pide confirmación antes de agregarlo
  if (item.fueraDeRed) pendiente.value = item
  else seleccionados.value.push({ ...item, uid: ++uid })
}

// ---- Confirmación de exámenes fuera de la red ----
const pendiente = ref(null)
const botonCancelar = ref(null)
watch(pendiente, async (p) => {
  if (p) {
    await nextTick()
    botonCancelar.value?.focus()
  }
})
function aceptarFueraDeRed() {
  seleccionados.value.push({ ...pendiente.value, uid: ++uid })
  pendiente.value = null
}
const cancelarFueraDeRed = () => (pendiente.value = null)
const nFueraDeRed = computed(() => seleccionados.value.filter((s) => s.fueraDeRed).length)

function quitar(uidItem) {
  seleccionados.value = seleccionados.value.filter((s) => s.uid !== uidItem)
}

const faltaLado = computed(() => seleccionados.value.filter((s) => s.pideLado && !s.lado).length)

let timer
function mostrarAviso(texto) {
  aviso.value = texto
  clearTimeout(timer)
  timer = setTimeout(() => (aviso.value = ''), 3500)
}

const confirmada = ref(null)
const impresion = ref(null) // procedimientos fuera de la red que se imprimen al confirmar
const nombrePerfil = computed(() => perfiles.value.find((p) => p.id === sesion.perfilSolicitud)?.nombre ?? 'Sin perfil indicado')

async function confirmar() {
  confirmada.value = seleccionados.value.map((s) => ({
    codigo: s.codigo,
    loinc: s.loinc,
    nombre: s.nombre,
    // Atributos como LOINC Parts
    modalidad: s.modalidades.map(lpObj),
    parteCuerpo: s.regiones.map(lpObj),
    lateralidad: (s.lado ? [s.lado] : s.lateralidades).map(lpObj),
    fueraDeRed: s.fueraDeRed,
    destino: s.fueraDeRed ? 'Fuera de la red (impreso, no ingresa a lista de espera)' : 'Lista de espera'
  }))
  const fuera = seleccionados.value.filter((s) => s.fueraDeRed)
  impresion.value = fuera.length
    ? {
        fecha: new Date().toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' }),
        sede: nombreSede.value,
        perfil: nombrePerfil.value,
        items: fuera.map((s) => ({
          codigo: s.codigo,
          loinc: s.loinc,
          nombre: s.nombre,
          modalidad: s.modalidades.map((m) => modPorCodigo.value[m]?.corto ?? m).join(', '),
          lateralidad: nombresLista(s.lado ? [s.lado] : s.lateralidades)
        }))
      }
    : null
  if (impresion.value) imprimir()
}
async function imprimir() {
  await nextTick()
  window.print()
}
const lpObj = (codigo) => ({ codigo, nombre: nombres.value[codigo] ?? codigo })
function vaciar() {
  seleccionados.value = []
  confirmada.value = null
  impresion.value = null
}
</script>

<template>
  <header class="barra">
    <div>
      <h1>Solicitud de exámenes de imagenología</h1>
      <p>Restrinja por modalidad, parte del cuerpo y lateralidad (o desde la figura) y elija el examen de la lista.</p>
    </div>
    <div class="contexto">
      <label>
        <span>Sede</span>
        <select v-model="sesion.sedeSolicitud">
          <option v-for="s in sedes" :key="s.id" :value="s.id">{{ s.nombre }}</option>
        </select>
      </label>
      <label>
        <span>Perfil profesional</span>
        <select v-model="sesion.perfilSolicitud" :class="{ falta: !sesion.perfilSolicitud }">
          <option :value="null">— Elija su perfil —</option>
          <option v-for="p in perfiles" :key="p.id" :value="p.id">{{ p.nombre }}</option>
        </select>
      </label>
      <button
        class="btn-completo"
        :class="{ on: catalogoCompleto }"
        :aria-pressed="catalogoCompleto"
        @click="catalogoCompleto = !catalogoCompleto"
      >
        {{ catalogoCompleto ? 'Volver al catálogo de la red' : 'Ver catálogo completo' }}
      </button>
      <small>
        {{ enRedLista.length.toLocaleString('es-CL') }} códigos solicitables en la red
        <template v-if="restringidosPerfil"> · {{ restringidosPerfil.toLocaleString('es-CL') }} restringidos a otros perfiles</template>
      </small>
    </div>
  </header>

  <p v-if="catalogoCompleto" class="aviso-completo card">
    Mostrando el <strong>catálogo completo</strong> ({{ catalogo.length.toLocaleString('es-CL') }} códigos), sin restricciones de sede ni perfil.
    Los {{ fueraDeRedIds.size.toLocaleString('es-CL') }} que están <strong>fuera de la red</strong> se marcan en naranjo y no ingresan a la lista de espera.
  </p>
  <p v-else-if="!catalogo.length && !restringidosPerfil" class="sin-codigos card">
    La sede <strong>{{ nombreSede }}</strong> no tiene códigos habilitados.
    Habilítelos en el <a href="#/mantenedor">mantenedor de códigos solicitables</a>.
  </p>

  <main class="layout">
    <aside class="card figura-card">
      <h2>Parte del cuerpo</h2>
      <BodyFigure v-model:parte="parte" v-model:lateralidad="lateralidad" :vocabulario="vocabulario" :conteo="conteoParte" :conteo-lat="conteoLat" />
    </aside>

    <section class="card buscador-card">
      <ExamSearch
        v-model:modalidades="modalidades"
        :conteo-modalidad="conteoModalidad"
        v-model:parte="parte"
        v-model:lateralidad="lateralidad"
        v-model:extras="extras"
        :conteo-ejes="conteoEjes"
        :vocabulario="vocabulario"
        :candidatos="candidatos"
        :agregados="agregados"
        :fuera-de-red="fueraDeRedIds"
        @seleccionar="agregar"
      />
    </section>

    <aside class="card solicitud">
      <h2>Exámenes seleccionados <span class="contador">{{ seleccionados.length }}</span></h2>
      <p v-if="!seleccionados.length" class="vacio">Aún no ha seleccionado exámenes.</p>
      <ul v-else class="items">
        <li v-for="s in seleccionados" :key="s.uid" :class="{ falta: s.pideLado && !s.lado, fuera: s.fueraDeRed }">
          <span class="badges">
            <span v-for="m in s.modalidades" :key="m" class="badge" :class="modPorCodigo[m]?.clase" :title="`${nombres[m]} · ${m}`">{{ modPorCodigo[m]?.corto ?? m }}</span>
          </span>
          <div class="item-info">
            <span v-if="s.fueraDeRed" class="tag-fuera">Fuera de la red · no ingresa a lista de espera</span>
            <strong>{{ s.nombre }}</strong>
            <small>{{ s.codigo }}<template v-if="s.loinc"> · LOINC {{ s.loinc }}</template> · {{ nombresLista(s.regiones) }} · {{ nombresLista(s.lateralidades) }}</small>
            <select v-if="s.pideLado" v-model="s.lado" :aria-label="`Lado de ${s.nombre}`">
              <option value="" disabled>Indique el lado…</option>
              <option v-for="l in LADOS" :key="l" :value="l">{{ nombres[l] ?? l }}</option>
            </select>
          </div>
          <button class="quitar" title="Quitar" @click="quitar(s.uid)">×</button>
        </li>
      </ul>
      <p v-if="nFueraDeRed" class="alerta-fuera">
        {{ nFueraDeRed }} examen(es) fuera de la red: al confirmar se imprimirán y no ingresarán a la lista de espera.
      </p>
      <p v-if="faltaLado" class="alerta">{{ faltaLado }} examen(es) unilateral(es) requieren indicar el lado.</p>
      <div class="acciones">
        <button class="btn secundario" :disabled="!seleccionados.length" @click="vaciar">Vaciar</button>
        <button class="btn" :disabled="!seleccionados.length || faltaLado > 0" @click="confirmar">Confirmar solicitud</button>
      </div>
      <p v-if="impresion" class="impreso">
        Se envió a imprimir {{ impresion.items.length }} procedimiento(s) fuera de la red.
        <button class="link" @click="imprimir">Reimprimir</button>
      </p>
      <details v-if="confirmada" class="json" open>
        <summary>Solicitud generada ({{ confirmada.length }})</summary>
        <pre>{{ JSON.stringify(confirmada, null, 2) }}</pre>
      </details>
    </aside>
  </main>

  <transition name="fade">
    <div v-if="aviso" class="toast">{{ aviso }}</div>
  </transition>

  <!-- Confirmación: examen fuera de la red de servicios -->
  <div v-if="pendiente" class="fondo-modal" @keydown.esc="cancelarFueraDeRed">
    <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="titulo-fuera" aria-describedby="texto-fuera">
      <h3 id="titulo-fuera">Examen fuera de la red</h3>
      <p class="examen-pendiente">{{ pendiente.nombre }}</p>
      <p id="texto-fuera">Esta solicitud está fuera de la red de servicios, por lo que no será incluida en la lista de espera.</p>
      <div class="pie-modal">
        <button ref="botonCancelar" class="btn secundario" @click="cancelarFueraDeRed">Cancelar</button>
        <button class="btn naranjo" @click="aceptarFueraDeRed">Aceptar</button>
      </div>
    </div>
  </div>

  <!-- Hoja impresa: solo los procedimientos fuera de la red -->
  <section v-if="impresion" class="impresion" aria-hidden="true">
    <h1>Solicitud de procedimientos fuera de la red de servicios</h1>
    <p class="datos">
      <span><strong>Fecha:</strong> {{ impresion.fecha }}</span>
      <span><strong>Sede:</strong> {{ impresion.sede }}</span>
      <span><strong>Perfil profesional:</strong> {{ impresion.perfil }}</span>
    </p>
    <p class="nota">Estos procedimientos están fuera de la red de servicios y no serán incluidos en la lista de espera.</p>
    <table>
      <thead>
        <tr><th>#</th><th>Código</th><th>LOINC</th><th>Procedimiento</th><th>Modalidad</th><th>Lateralidad</th></tr>
      </thead>
      <tbody>
        <tr v-for="(i, n) in impresion.items" :key="n">
          <td>{{ n + 1 }}</td><td>{{ i.codigo }}</td><td>{{ i.loinc ?? '—' }}</td><td>{{ i.nombre }}</td><td>{{ i.modalidad }}</td><td>{{ i.lateralidad }}</td>
        </tr>
      </tbody>
    </table>
    <div class="firma"><span>Nombre y firma del profesional</span></div>
  </section>
</template>

<style scoped>
.barra { padding: 20px 28px 8px; display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: flex-start; }
.contexto { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; justify-content: flex-end; }
.contexto label { display: grid; gap: 4px; }
.contexto label span { font-size: .75rem; font-weight: 600; color: var(--texto-suave); }
.contexto select { padding: 7px 10px; border: 1.5px solid var(--borde); border-radius: 8px; background: var(--superficie); font-size: .88rem; min-width: 190px; }
.contexto select.falta { border-color: #e9a23b; background: #fff8ec; }
.contexto small { flex-basis: 100%; text-align: right; color: var(--texto-suave); font-size: .78rem; }
.btn-completo {
  align-self: flex-end; padding: 7px 12px; border-radius: 8px; border: 1.5px solid #e07b00; background: var(--superficie);
  color: #b35f00; font-weight: 600; font-size: .85rem; cursor: pointer;
}
.btn-completo.on { background: #e07b00; color: #fff; }
.aviso-completo { margin: 8px 28px 0; padding: 12px 16px; background: #fff4e6; border: 1.5px solid #e07b00; font-size: .9rem; }
.items li.fuera { border: 2px solid #e07b00; background: #fff8f0; }
.tag-fuera { justify-self: start; font-size: .68rem; font-weight: 700; color: #fff; background: #e07b00; border-radius: 4px; padding: 1px 6px; }
.alerta-fuera { color: #b35f00; font-size: .82rem; margin: 10px 0 0; }
.impreso { margin: 10px 0 0; font-size: .82rem; color: #b35f00; }
.link { border: 0; background: none; color: var(--primario); cursor: pointer; font-size: .82rem; text-decoration: underline; padding: 0; }
.btn.naranjo { background: #e07b00; }
.fondo-modal { position: fixed; inset: 0; background: rgba(15, 27, 45, .45); display: grid; place-items: center; z-index: 60; padding: 16px; }
.modal { background: var(--superficie); border-radius: 14px; padding: 22px; width: min(460px, 100%); box-shadow: 0 20px 60px rgba(0,0,0,.25); border-top: 5px solid #e07b00; }
.modal h3 { margin: 0 0 8px; font-size: 1.05rem; color: #b35f00; }
.examen-pendiente { margin: 0 0 10px; font-weight: 600; }
.modal p { font-size: .92rem; }
.pie-modal { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.sin-codigos { margin: 8px 28px 0; padding: 12px 16px; background: #fff8ec; border-color: #f0cf91; font-size: .9rem; }
.badges { display: flex; flex-direction: column; gap: 2px; }
.barra h1 { margin: 0; font-size: 1.4rem; }
.barra p { margin: 4px 0 0; color: var(--texto-suave); font-size: .9rem; }

.layout {
  display: grid; gap: 18px; padding: 16px 28px 28px;
  grid-template-columns: 300px minmax(0, 1fr) 340px; align-items: start;
}
@media (max-width: 1150px) {
  .layout { grid-template-columns: 280px minmax(0, 1fr); }
  .solicitud { grid-column: 1 / -1; }
}
@media (max-width: 720px) {
  .layout { grid-template-columns: 1fr; padding: 12px; }
}
h2 { margin: 0 0 12px; font-size: 1rem; }
.figura-card { position: sticky; top: 16px; }
/* En pantallas angostas la figura no queda fija, para no tapar el carrito */
@media (max-width: 1150px) { .figura-card { position: static; } }
.buscador-card { position: relative; z-index: 5; }

.contador { background: var(--primario); color: #fff; font-size: .75rem; padding: 1px 8px; border-radius: 999px; margin-left: 4px; vertical-align: middle; }
.vacio { color: var(--texto-suave); font-size: .9rem; }
.items { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; max-height: 420px; overflow-y: auto; }
.items li {
  display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: start;
  border: 1px solid var(--borde); border-radius: 9px; padding: 9px 10px; background: var(--fondo);
}
.items li.falta { border-color: #e9a23b; background: #fff8ec; }
.item-info { display: grid; gap: 3px; }
.item-info strong { font-size: .88rem; font-weight: 600; }
.item-info small { color: var(--texto-suave); font-size: .75rem; }
.item-info select { margin-top: 3px; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--borde); font-size: .82rem; background: var(--superficie); }
.quitar { border: 0; background: none; font-size: 1.2rem; color: var(--texto-suave); cursor: pointer; line-height: 1; }
.quitar:hover { color: #c0392b; }
.alerta { color: #a8650a; font-size: .82rem; margin: 10px 0 0; }
.acciones { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }
.btn { border: 0; background: var(--primario); color: #fff; padding: 9px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: .88rem; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn.secundario { background: var(--fondo); color: var(--texto); border: 1px solid var(--borde); }
.json { margin-top: 14px; font-size: .78rem; }
.json pre { background: #0f1b2d; color: #d6e4ff; padding: 10px; border-radius: 8px; overflow: auto; max-height: 260px; }

.toast {
  position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%);
  background: #1d2b40; color: #fff; padding: 10px 18px; border-radius: 9px; font-size: .88rem;
  box-shadow: 0 8px 24px rgba(0,0,0,.2);
}
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
