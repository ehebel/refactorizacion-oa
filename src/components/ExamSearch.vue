<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { buscarTexto, resaltar } from '../utils/filtros'

const modalidades = defineModel('modalidades', { type: Array, default: () => [] })
const parte = defineModel('parte', { type: String, default: null })
const lateralidad = defineModel('lateralidad', { type: String, default: null })
const extras = defineModel('extras', { type: Object, default: () => ({}) }) // filtros del Playbook

const props = defineProps({
  candidatos: { type: Array, required: true }, // exámenes ya restringidos por los filtros
  // Opciones de los filtros extraídas de los LOINC Parts del catálogo
  vocabulario: { type: Object, required: true },
  agregados: { type: Set, default: () => new Set() }, // códigos ya en la solicitud
  fueraDeRed: { type: Set, default: () => new Set() }, // códigos fuera de la red (catálogo completo)
  conteoModalidad: { type: Object, default: () => ({}) },
  conteoEjes: { type: Object, default: () => ({}) }, // { eje: { códigoLP: nº } }
  maxResultados: { type: Number, default: 60 }
})
const emit = defineEmits(['seleccionar'])

const raiz = ref(null)
const listaEl = ref(null)
const consulta = ref('')
const abierto = ref(false)
const activo = ref(0)

const nombres = computed(() => props.vocabulario.nombres)
const modPorCodigo = computed(() => Object.fromEntries(props.vocabulario.modalidades.map((m) => [m.codigo, m])))

const nExtras = computed(() => Object.values(extras.value).filter(Boolean).length)
const hayFiltros = computed(() => !!(modalidades.value.length || parte.value || lateralidad.value || nExtras.value))

// Todos los combos (parte, lateralidad y Playbook) van dentro de «Más filtros»
const masAbierto = ref(false)
const nCombos = computed(() => (parte.value ? 1 : 0) + (lateralidad.value ? 1 : 0) + nExtras.value)
function quitarCombos() {
  parte.value = null
  lateralidad.value = null
  extras.value = {}
}
// Solo opciones alcanzables con los demás filtros (o la ya elegida)
// Imaging focus va en orden alfabético; los demás, de más a menos exámenes.
function opcionesEje(eje) {
  const n = props.conteoEjes[eje.clave] ?? {}
  const lista = eje.opciones.filter((o) => n[o.codigo] || extras.value[eje.clave] === o.codigo)
  return eje.orden === 'alfabetico' ? lista : lista.sort((a, b) => (n[b.codigo] ?? 0) - (n[a.codigo] ?? 0))
}
const fijarExtra = (clave, valor) => (extras.value = { ...extras.value, [clave]: valor || null })
const resultados = computed(() => buscarTexto(props.candidatos, consulta.value))
const visibles = computed(() => resultados.value.slice(0, props.maxResultados))
const mostrar = computed(() => abierto.value && (hayFiltros.value || consulta.value.trim().length > 0))

// Al elegir (o cambiar) un filtro, la lista se despliega automáticamente
watch([modalidades, parte, lateralidad, extras], () => {
  abierto.value = hayFiltros.value || consulta.value.trim().length > 0
  activo.value = 0
})
watch(consulta, () => (activo.value = 0))

// Cerrar al hacer clic fuera del buscador
function clicFuera(ev) {
  if (raiz.value && !raiz.value.contains(ev.target)) abierto.value = false
}
onMounted(() => document.addEventListener('mousedown', clicFuera))
onBeforeUnmount(() => document.removeEventListener('mousedown', clicFuera))

function mover(delta) {
  abierto.value = true
  if (!visibles.value.length) return
  activo.value = (activo.value + delta + visibles.value.length) % visibles.value.length
  requestAnimationFrame(() => {
    listaEl.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  })
}

function elegir(examen) {
  if (!examen) return
  emit('seleccionar', examen)
}

function alternarModalidad(id) {
  modalidades.value = modalidades.value.includes(id)
    ? modalidades.value.filter((m) => m !== id)
    : [...modalidades.value, id]
}

function limpiarFiltros() {
  modalidades.value = []
  parte.value = null
  lateralidad.value = null
  extras.value = {}
}
</script>

<template>
  <div ref="raiz" class="buscador">
    <div class="modalidades">
      <div class="cab">
        <span>Modalidad</span>
        <button v-if="modalidades.length" class="link" @click="modalidades = []">Todas</button>
      </div>
      <div class="chips">
        <button
          v-for="m in vocabulario.modalidades"
          :key="m.codigo"
          class="chip"
          :class="[m.clase, { on: modalidades.includes(m.codigo), cero: !conteoModalidad[m.codigo] }]"
          :title="`${m.nombre} · ${m.nombreEn} · ${m.codigo}`"
          :aria-pressed="modalidades.includes(m.codigo)"
          @click="alternarModalidad(m.codigo)"
        >
          {{ m.corto }} <small>{{ conteoModalidad[m.codigo] ?? 0 }}</small>
        </button>
      </div>
    </div>

    <!-- Todos los combos quedan bajo «Más filtros» -->
    <details class="mas" :open="masAbierto" @toggle="masAbierto = $event.target.open">
      <summary>
        Más filtros<template v-if="nCombos"> · {{ nCombos }} activo(s)</template>
        <button v-if="nCombos" class="link quitar-combos" @click.prevent="quitarCombos">Quitar</button>
      </summary>
      <div class="filtros">
        <label>
          <span>Parte del cuerpo</span>
          <select v-model="parte" :class="{ elegido: parte }">
            <option :value="null">Todas las partes del cuerpo</option>
            <option
              v-for="p in vocabulario.partes"
              :key="p.codigo"
              :value="p.codigo"
              :title="`${p.nombreEn} · ${p.codigo}`"
            >{{ p.nombre }}{{ p.incluye.length ? ` (incluye ${p.incluye.join(', ')})` : '' }} · {{ p.codigo }}</option>
          </select>
        </label>
        <label>
          <span>Lateralidad</span>
          <select v-model="lateralidad" :class="{ elegido: lateralidad }">
            <option :value="null">Todas las lateralidades</option>
            <option v-for="l in vocabulario.lateralidades" :key="l.codigo" :value="l.codigo" :title="`${l.nombreEn} · ${l.codigo}`">{{ l.nombre }} · {{ l.codigo }}</option>
          </select>
        </label>
      </div>

      <div v-if="vocabulario.ejes.length" class="playbook">
        <span class="titulo-playbook">Radiology Playbook LOINC/RSNA</span>
        <div class="filtros">
          <label v-for="eje in vocabulario.ejes" :key="eje.clave">
            <span>{{ eje.titulo }}</span>
            <select
              :value="extras[eje.clave] ?? ''"
              :class="{ elegido: extras[eje.clave] }"
              :disabled="!opcionesEje(eje).length"
              @change="fijarExtra(eje.clave, $event.target.value)"
            >
              <option value="">{{ opcionesEje(eje).length ? `Todos (${opcionesEje(eje).length})` : 'Sin opciones' }}</option>
              <option v-for="o in opcionesEje(eje)" :key="o.codigo" :value="o.codigo" :title="`${o.nombreEn} · ${o.codigo}`">
                {{ o.nombre }} ({{ conteoEjes[eje.clave]?.[o.codigo] ?? 0 }})
              </option>
            </select>
          </label>
        </div>
      </div>
    </details>

    <div class="campo">
      <svg class="lupa" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
      </svg>
      <input
        v-model="consulta"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="lista-examenes"
        :aria-expanded="mostrar"
        placeholder="Buscar examen…"
        autocomplete="off"
        @focus="abierto = true"
        @input="abierto = true"
        @keydown.down.prevent="mover(1)"
        @keydown.up.prevent="mover(-1)"
        @keydown.enter.prevent="elegir(visibles[activo])"
        @keydown.esc="abierto = false"
      />
      <button v-if="consulta" class="borrar" title="Borrar texto" @click="consulta = ''">×</button>

      <div v-if="mostrar" class="panel">
        <p v-if="!resultados.length" class="aviso">Sin exámenes que coincidan con los filtros{{ consulta ? ' y el texto' : '' }}.</p>
        <template v-else>
          <ul id="lista-examenes" ref="listaEl" role="listbox" class="lista">
            <li
              v-for="(e, i) in visibles"
              :key="e.id"
              role="option"
              :aria-selected="i === activo"
              :class="{ activo: i === activo, agregado: agregados.has(e.id), fuera: fueraDeRed.has(e.id) }"
              :title="agregados.has(e.id) ? 'Ya está en la solicitud' : null"
              @mousedown.prevent
              @mouseenter="activo = i"
              @click="elegir(e)"
            >
              <span class="badges">
                <span v-for="m in e.modalidades" :key="m" class="badge" :class="modPorCodigo[m]?.clase" :title="`${nombres[m]} · ${m}`">{{ modPorCodigo[m]?.corto ?? m }}</span>
              </span>
              <span class="nombre">
                <template v-for="(s, k) in resaltar(e.nombre, consulta)" :key="k">
                  <mark v-if="s.marca">{{ s.texto }}</mark><template v-else>{{ s.texto }}</template>
                </template>
              <span v-if="fueraDeRed.has(e.id)" class="tag-fuera">Fuera de la red</span></span>
            </li>
          </ul>
          <p class="pie">
            {{ resultados.length }} resultado(s)
            <template v-if="resultados.length > visibles.length"> · mostrando {{ visibles.length }}</template>
            · ↑↓ navegar · Enter agregar · Esc cerrar
          </p>
        </template>
      </div>
    </div>

    <div class="estado">
      <span><strong>{{ candidatos.length }}</strong> exámenes con los filtros actuales</span>
      <button v-if="hayFiltros" class="link" @click="limpiarFiltros">Limpiar filtros</button>
    </div>
  </div>
</template>

<style scoped>
.modalidades { margin-bottom: 14px; }
.cab { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.cab span { font-size: .8rem; font-weight: 600; color: var(--texto-suave); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  border: 1.5px solid var(--borde); background: var(--superficie); color: var(--texto);
  padding: 5px 12px; border-radius: 999px; font-size: .85rem; cursor: pointer;
  transition: background .12s, border-color .12s, color .12s, opacity .12s;
}
.chip small { font-size: .7rem; opacity: .7; margin-left: 2px; font-weight: 500; }
.chip.on small { opacity: .9; }
.chip.cero:not(.on) { opacity: .45; }
.filtros { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
@media (max-width: 720px) { .filtros { grid-template-columns: 1fr; } }
label span { display: block; font-size: .8rem; font-weight: 600; color: var(--texto-suave); margin-bottom: 5px; }
select {
  width: 100%; padding: 10px 12px; font-size: .95rem; border: 1.5px solid var(--borde); border-radius: 10px;
  background: var(--superficie); color: var(--texto); cursor: pointer;
}
.playbook { border-top: 1px dashed var(--borde); padding-top: 10px; }
.titulo-playbook { display: block; font-size: .75rem; font-weight: 600; color: var(--texto-suave); margin-bottom: 8px; }
.quitar-combos { margin-left: 10px; font-weight: 500; }
.playbook .filtros { margin-bottom: 10px; }
.playbook select { padding: 7px 10px; font-size: .85rem; }
select.elegido { border-color: var(--primario); background: var(--primario-suave); font-weight: 600; }
.mas { margin-bottom: 12px; }
.mas summary { cursor: pointer; font-size: .85rem; font-weight: 600; color: var(--primario); margin-bottom: 10px; }
.mas[open] { border: 1px solid var(--borde); border-radius: 10px; padding: 10px 12px 2px; }
select:disabled { opacity: .5; cursor: default; }
select:focus { outline: none; border-color: var(--primario); box-shadow: 0 0 0 3px var(--primario-suave); }

.campo { position: relative; display: flex; align-items: center; }
.lupa {
  position: absolute; left: 12px; width: 18px; height: 18px;
  fill: none; stroke: var(--texto-suave); stroke-width: 2; stroke-linecap: round;
}
input {
  width: 100%; padding: 12px 36px 12px 40px; font-size: 1rem;
  border: 1.5px solid var(--borde); border-radius: 10px; background: var(--superficie);
  color: var(--texto); outline: none; transition: border-color .15s, box-shadow .15s;
}
input:focus { border-color: var(--primario); box-shadow: 0 0 0 3px var(--primario-suave); }
.borrar {
  position: absolute; right: 8px; border: 0; background: none; font-size: 1.3rem;
  color: var(--texto-suave); cursor: pointer; line-height: 1; padding: 4px 6px;
}
.panel {
  position: absolute; z-index: 20; top: calc(100% + 6px); left: 0; right: 0;
  background: var(--superficie); border: 1px solid var(--borde); border-radius: 10px;
  box-shadow: 0 12px 32px rgba(15, 30, 60, .14); overflow: hidden;
}
.aviso { margin: 0; padding: 14px 16px; color: var(--texto-suave); font-size: .9rem; }
.lista { list-style: none; margin: 0; padding: 4px; max-height: 360px; overflow-y: auto; }
.lista li {
  display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center;
  padding: 8px 10px; border-radius: 7px; cursor: pointer;
}
.lista li.activo { background: var(--primario-suave); }
.lista li.agregado .nombre { color: var(--texto-suave); }
.nombre { font-size: .95rem; }
.badges { display: flex; flex-direction: column; gap: 2px; }
.lista li.fuera { box-shadow: inset 3px 0 0 #e07b00; }
.tag-fuera { margin-left: 6px; font-size: .66rem; font-weight: 700; color: #fff; background: #e07b00; border-radius: 4px; padding: 1px 5px; vertical-align: 1px; white-space: nowrap; }
.nombre mark { background: #ffe58a; color: inherit; border-radius: 2px; padding: 0 1px; }
.pie {
  margin: 0; padding: 7px 14px; font-size: .75rem; color: var(--texto-suave);
  border-top: 1px solid var(--borde); background: var(--fondo);
}
.estado { display: flex; gap: 12px; align-items: center; margin-top: 10px; font-size: .85rem; color: var(--texto-suave); }
.link { border: 0; background: none; color: var(--primario); cursor: pointer; font-size: .85rem; text-decoration: underline; padding: 0; }
</style>
