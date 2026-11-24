<script setup>
import { ref, computed, watch } from 'vue'
import { catalogo, vocabulario, config, sesion, habilitadosPorSede, habilitar, restringir, perfilesDe } from '../store'
import { filtrarExamenes, buscarTexto } from '../utils/filtros'

const POR_PAGINA = 50
const fmt = (n) => (n ?? 0).toLocaleString('es-CL')

const sede = computed(() => config.sedes.find((s) => s.id === sesion.sedeMantenedor) ?? config.sedes[0])
const habilitados = computed(() => habilitadosPorSede.value[sede.value?.id] ?? new Set())
// Conteos sobre los códigos del catálogo actual (la configuración puede tener otros)
const nHabilitados = computed(() => catalogo.value.examenes.reduce((n, e) => n + habilitados.value.has(e.id), 0))
const nRestringidos = computed(() => catalogo.value.examenes.reduce((n, e) => n + (perfilesDe(e.id).length > 0), 0))
const nombrePerfil = computed(() => Object.fromEntries(config.perfiles.map((p) => [p.id, p.nombre])))
const modPorCodigo = computed(() => Object.fromEntries(vocabulario.value.modalidades.map((m) => [m.codigo, m])))
const ejeFoco = computed(() => vocabulario.value.ejes.find((e) => e.clave === 'foco'))

// ---- Filtros ----
const texto = ref('')
const modalidad = ref('')
const parte = ref('')
const lateralidad = ref('')
const foco = ref('')
const estadoFiltro = ref('') // '' | 'si' | 'no'
const restriccion = ref('') // '' | 'libre' | 'restringido' | perfilId

const filtrados = computed(() => {
  let lista = filtrarExamenes(catalogo.value.examenes, {
    modalidades: modalidad.value ? [modalidad.value] : [],
    parte: parte.value || null,
    lateralidad: lateralidad.value || null,
    extras: foco.value ? { foco: foco.value } : {}
  })
  lista = buscarTexto(lista, texto.value)
  if (estadoFiltro.value) lista = lista.filter((e) => habilitados.value.has(e.id) === (estadoFiltro.value === 'si'))
  if (restriccion.value === 'libre') lista = lista.filter((e) => !perfilesDe(e.id).length)
  else if (restriccion.value === 'restringido') lista = lista.filter((e) => perfilesDe(e.id).length)
  else if (restriccion.value) lista = lista.filter((e) => perfilesDe(e.id).includes(restriccion.value))
  return lista
})
const hayFiltros = computed(
  () => !!(texto.value || modalidad.value || parte.value || lateralidad.value || foco.value || estadoFiltro.value || restriccion.value)
)
function limpiar() {
  texto.value = modalidad.value = parte.value = lateralidad.value = foco.value = estadoFiltro.value = restriccion.value = ''
}

// ---- Paginación ----
const pagina = ref(0)
const paginas = computed(() => Math.max(1, Math.ceil(filtrados.value.length / POR_PAGINA)))
const visibles = computed(() => filtrados.value.slice(pagina.value * POR_PAGINA, (pagina.value + 1) * POR_PAGINA))
watch(filtrados, () => (pagina.value = Math.min(pagina.value, paginas.value - 1)))
watch([texto, modalidad, parte, lateralidad, foco, estadoFiltro, restriccion], () => (pagina.value = 0))

// ---- Selección ----
const seleccion = ref(new Set())
const idsFiltrados = computed(() => filtrados.value.map((e) => e.id))
const todosVisiblesMarcados = computed(() => visibles.value.length > 0 && visibles.value.every((e) => seleccion.value.has(e.id)))
function marcar(id, si) {
  const s = new Set(seleccion.value)
  si ? s.add(id) : s.delete(id)
  seleccion.value = s
}
function marcarVisibles(si) {
  const s = new Set(seleccion.value)
  for (const e of visibles.value) si ? s.add(e.id) : s.delete(e.id)
  seleccion.value = s
}
const marcarFiltrados = () => (seleccion.value = new Set(idsFiltrados.value))
const limpiarSeleccion = () => (seleccion.value = new Set())
watch(() => catalogo.value, limpiarSeleccion)

// ---- Acciones ----
const alternar = (e) => habilitar(sede.value.id, [e.id], !habilitados.value.has(e.id))
const habilitarSel = (si) => habilitar(sede.value.id, [...seleccion.value], si)
const quitarRestriccionSel = () => restringir([...seleccion.value], [])

// ---- Editor de perfiles permitidos ----
const editor = ref(null) // { ids: [...], marcados: Set, titulo }
const buscarPerfil = ref('')
function abrirEditor(ids, titulo) {
  // Parte de los perfiles comunes a todos los códigos elegidos
  const listas = ids.map(perfilesDe)
  const comunes = listas[0]?.filter((p) => listas.every((l) => l.includes(p))) ?? []
  editor.value = { ids, titulo, marcados: new Set(comunes), mixtos: new Set(listas.length > 1 ? listas.flat() : []) }
  buscarPerfil.value = ''
}
const perfilesEditor = computed(() => {
  const q = buscarPerfil.value.trim().toLowerCase()
  return q ? config.perfiles.filter((p) => p.nombre.toLowerCase().includes(q)) : config.perfiles
})
function alternarPerfil(id) {
  const s = new Set(editor.value.marcados)
  s.has(id) ? s.delete(id) : s.add(id)
  editor.value = { ...editor.value, marcados: s }
}
function guardarEditor(sinRestriccion = false) {
  restringir(editor.value.ids, sinRestriccion ? [] : [...editor.value.marcados])
  editor.value = null
}
</script>

<template>
  <div class="tabla-codigos">
    <div class="cabecera">
      <div>
        <span class="etiqueta">Configurando sede</span>
        <select v-model="sesion.sedeMantenedor" class="sede">
          <option v-for="s in config.sedes" :key="s.id" :value="s.id">{{ s.nombre }}</option>
        </select>
      </div>
      <p>
        <strong>{{ fmt(nHabilitados) }}</strong> de {{ fmt(catalogo.examenes.length) }} códigos habilitados en esta sede ·
        <strong>{{ fmt(nRestringidos) }}</strong> códigos restringidos por perfil (en todas las sedes)
      </p>
    </div>

    <!-- Filtros -->
    <div class="filtros">
      <input v-model="texto" type="search" class="buscar" placeholder="Buscar por nombre, código local, LOINC, foco anatómico…" />
      <select v-model="modalidad">
        <option value="">Todas las modalidades</option>
        <option v-for="m in vocabulario.modalidades" :key="m.codigo" :value="m.codigo">{{ m.corto }} · {{ m.nombre }}</option>
      </select>
      <select v-model="parte">
        <option value="">Todas las partes del cuerpo</option>
        <option v-for="p in vocabulario.partes" :key="p.codigo" :value="p.codigo">{{ p.nombre }}</option>
      </select>
      <select v-model="lateralidad">
        <option value="">Todas las lateralidades</option>
        <option v-for="l in vocabulario.lateralidades" :key="l.codigo" :value="l.codigo">{{ l.nombre }}</option>
      </select>
      <select v-if="ejeFoco" v-model="foco">
        <option value="">Todos los focos anatómicos</option>
        <option v-for="o in ejeFoco.opciones" :key="o.codigo" :value="o.codigo">{{ o.nombre }}</option>
      </select>
      <select v-model="estadoFiltro">
        <option value="">Habilitados y no habilitados</option>
        <option value="si">Solo habilitados</option>
        <option value="no">Solo no habilitados</option>
      </select>
      <select v-model="restriccion">
        <option value="">Con y sin restricción de perfil</option>
        <option value="libre">Sin restricción (todos los perfiles)</option>
        <option value="restringido">Con restricción de perfil</option>
        <optgroup label="Que puede solicitar…">
          <option v-for="p in config.perfiles" :key="p.id" :value="p.id">{{ p.nombre }}</option>
        </optgroup>
      </select>
      <button v-if="hayFiltros" class="link" @click="limpiar">Limpiar filtros</button>
    </div>

    <!-- Acciones en lote -->
    <div class="lote" :class="{ activo: seleccion.size }">
      <template v-if="seleccion.size">
        <strong>{{ fmt(seleccion.size) }} seleccionados</strong>
        <button class="btn" @click="habilitarSel(true)">Habilitar en {{ sede.nombre }}</button>
        <button class="btn secundario" @click="habilitarSel(false)">Deshabilitar</button>
        <button class="btn secundario" @click="abrirEditor([...seleccion], `${fmt(seleccion.size)} códigos seleccionados`)">Perfiles permitidos…</button>
        <button class="btn secundario" @click="quitarRestriccionSel">Quitar restricción</button>
        <button class="link" @click="limpiarSeleccion">Limpiar selección</button>
      </template>
      <template v-else>
        <span>{{ fmt(filtrados.length) }} códigos{{ hayFiltros ? ' con los filtros' : '' }}.</span>
        <button class="link" :disabled="!filtrados.length" @click="marcarFiltrados">Seleccionar los {{ fmt(filtrados.length) }}</button>
        <span class="ayuda">para habilitarlos o restringirlos en lote.</span>
      </template>
    </div>

    <!-- Tabla -->
    <div class="contenedor">
      <table>
        <thead>
          <tr>
            <th class="c-sel">
              <input type="checkbox" :checked="todosVisiblesMarcados" aria-label="Seleccionar los de esta página" @change="marcarVisibles($event.target.checked)" />
            </th>
            <th class="c-hab">Habilitado</th>
            <th>Código</th>
            <th>Examen</th>
            <th>Modalidad</th>
            <th>Perfiles que pueden solicitarlo</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in visibles" :key="e.id" :class="{ off: !habilitados.has(e.id), marcado: seleccion.has(e.id) }">
            <td class="c-sel">
              <input type="checkbox" :checked="seleccion.has(e.id)" :aria-label="`Seleccionar ${e.nombre}`" @change="marcar(e.id, $event.target.checked)" />
            </td>
            <td class="c-hab">
              <button
                class="switch"
                role="switch"
                :aria-checked="habilitados.has(e.id)"
                :aria-label="`${habilitados.has(e.id) ? 'Deshabilitar' : 'Habilitar'} ${e.nombre} en ${sede.nombre}`"
                @click="alternar(e)"
              ><span></span></button>
            </td>
            <td class="c-cod">
              {{ e.codigo }}
              <small v-if="e.loinc">LOINC {{ e.loinc }}</small>
            </td>
            <td class="c-nom">
              {{ e.nombre }}
              <small v-if="e.nombreEn">{{ e.nombreEn }}</small>
            </td>
            <td>
              <span class="badges">
                <span v-for="m in e.modalidades" :key="m" class="badge" :class="modPorCodigo[m]?.clase" :title="modPorCodigo[m]?.nombre">{{ modPorCodigo[m]?.corto ?? m }}</span>
              </span>
            </td>
            <td class="c-perf">
              <button class="perfiles" :title="'Editar perfiles permitidos'" @click="abrirEditor([e.id], e.nombre)">
                <template v-if="perfilesDe(e.id).length">
                  <span v-for="p in perfilesDe(e.id)" :key="p" class="chip-perfil">{{ nombrePerfil[p] ?? p }}</span>
                </template>
                <span v-else class="todos">Todos los perfiles</span>
                <span class="lapiz" aria-hidden="true">✎</span>
              </button>
            </td>
          </tr>
          <tr v-if="!visibles.length">
            <td colspan="6" class="vacio">No hay códigos con estos filtros.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="paginacion" v-if="paginas > 1">
      <button class="btn secundario" :disabled="pagina === 0" @click="pagina--">‹ Anterior</button>
      <span>Página {{ pagina + 1 }} de {{ fmt(paginas) }}</span>
      <button class="btn secundario" :disabled="pagina >= paginas - 1" @click="pagina++">Siguiente ›</button>
    </div>

    <!-- Editor de perfiles -->
    <div v-if="editor" class="fondo-modal" @mousedown.self="editor = null">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-editor">
        <h3 id="titulo-editor">Perfiles que pueden solicitar</h3>
        <p class="sub">{{ editor.titulo }}</p>
        <p class="nota">
          Sin perfiles marcados, el código queda disponible para <strong>todos los perfiles</strong>.
          La restricción aplica en todas las sedes.
          <template v-if="editor.ids.length > 1"> Se reemplazará la restricción de los {{ fmt(editor.ids.length) }} códigos.</template>
        </p>
        <input v-model="buscarPerfil" class="buscar-perfil" placeholder="Filtrar perfiles…" />
        <div class="perfiles-grid">
          <label v-for="p in perfilesEditor" :key="p.id" :class="{ mixto: !editor.marcados.has(p.id) && editor.mixtos.has(p.id) }">
            <input type="checkbox" :checked="editor.marcados.has(p.id)" @change="alternarPerfil(p.id)" />
            {{ p.nombre }}
          </label>
        </div>
        <div class="pie-modal">
          <button class="link" @click="guardarEditor(true)">Permitir a todos los perfiles</button>
          <span class="espacio"></span>
          <button class="btn secundario" @click="editor = null">Cancelar</button>
          <button class="btn" @click="guardarEditor()">
            {{ editor.marcados.size ? `Restringir a ${editor.marcados.size} perfil(es)` : 'Guardar sin restricción' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cabecera { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: flex-end; justify-content: space-between; margin-bottom: 12px; }
.cabecera p { margin: 0; font-size: .85rem; color: var(--texto-suave); }
.etiqueta { display: block; font-size: .75rem; font-weight: 600; color: var(--texto-suave); margin-bottom: 4px; }
.sede { padding: 8px 12px; border: 1.5px solid var(--primario); border-radius: 8px; background: var(--primario-suave); font-weight: 600; font-size: .92rem; min-width: 220px; }

.filtros { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.filtros select, .buscar { padding: 7px 9px; border: 1.5px solid var(--borde); border-radius: 8px; background: var(--superficie); font-size: .82rem; max-width: 230px; }
.buscar { flex: 1 1 280px; max-width: none; }

.lote { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 8px; background: var(--fondo); font-size: .85rem; margin-bottom: 8px; min-height: 46px; }
.lote.activo { background: var(--primario-suave); }
.lote .ayuda { color: var(--texto-suave); }

.contenedor { overflow-x: auto; border: 1px solid var(--borde); border-radius: 10px; }
table { width: 100%; border-collapse: collapse; font-size: .85rem; }
th { text-align: left; font-size: .75rem; color: var(--texto-suave); font-weight: 600; padding: 8px 10px; background: var(--fondo); border-bottom: 1px solid var(--borde); position: sticky; top: 0; }
td { padding: 7px 10px; border-bottom: 1px solid var(--borde); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
tr.off td.c-nom, tr.off td.c-cod { color: var(--texto-suave); }
tr.marcado td { background: #f4f8fe; }
.c-sel { width: 30px; }
.c-hab { width: 84px; }
.c-cod { white-space: nowrap; font-family: ui-monospace, monospace; font-size: .78rem; }
.c-cod small, .c-nom small { display: block; color: var(--texto-suave); font-size: .72rem; margin-top: 1px; }
.c-nom { min-width: 260px; }
.c-perf { min-width: 220px; }
.badges { display: flex; flex-wrap: wrap; gap: 3px; }
.vacio { text-align: center; color: var(--texto-suave); padding: 22px; }

.switch { position: relative; width: 38px; height: 22px; border-radius: 999px; border: 0; background: #c3cedc; cursor: pointer; padding: 0; transition: background .15s; }
.switch span { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left .15s; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.switch[aria-checked='true'] { background: #0f8a6c; }
.switch[aria-checked='true'] span { left: 19px; }

.perfiles { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; border: 1px dashed transparent; background: none; padding: 3px 4px; border-radius: 7px; cursor: pointer; text-align: left; width: 100%; }
.perfiles:hover { border-color: var(--borde); background: var(--fondo); }
.chip-perfil { background: #fdf0e1; color: #8a4b0a; border: 1px solid #f0cf91; border-radius: 999px; padding: 1px 8px; font-size: .74rem; font-weight: 600; }
.todos { color: var(--texto-suave); font-size: .78rem; }
.lapiz { margin-left: auto; color: var(--texto-suave); opacity: 0; }
.perfiles:hover .lapiz { opacity: 1; }

.paginacion { display: flex; gap: 12px; align-items: center; justify-content: center; margin-top: 12px; font-size: .85rem; }

.fondo-modal { position: fixed; inset: 0; background: rgba(15, 27, 45, .45); display: grid; place-items: center; z-index: 50; padding: 16px; }
.modal { background: var(--superficie); border-radius: 14px; padding: 20px; width: min(560px, 100%); max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,.25); }
.modal h3 { margin: 0; font-size: 1.05rem; }
.sub { margin: 4px 0 0; font-weight: 600; font-size: .9rem; }
.nota { margin: 8px 0 10px; font-size: .8rem; color: var(--texto-suave); }
.buscar-perfil { padding: 7px 10px; border: 1.5px solid var(--borde); border-radius: 8px; font-size: .85rem; margin-bottom: 10px; }
.perfiles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px; overflow-y: auto; }
.perfiles-grid label { display: flex; gap: 8px; align-items: center; font-size: .86rem; padding: 5px 6px; border-radius: 6px; cursor: pointer; }
.perfiles-grid label:hover { background: var(--fondo); }
.perfiles-grid label.mixto { color: #8a4b0a; font-style: italic; }
.pie-modal { display: flex; gap: 8px; align-items: center; margin-top: 14px; flex-wrap: wrap; }
.espacio { flex: 1; }

.btn { border: 0; background: var(--primario); color: #fff; padding: 7px 13px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: .82rem; white-space: nowrap; }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn.secundario { background: var(--superficie); color: var(--texto); border: 1px solid var(--borde); }
.link { border: 0; background: none; color: var(--primario); cursor: pointer; font-size: .82rem; text-decoration: underline; padding: 0; }
.link:disabled { opacity: .5; cursor: default; }
</style>
