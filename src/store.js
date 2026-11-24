// Estado compartido entre el mantenedor y la solicitud de exámenes.
//
//   insumos → fuente / collection OCL y Playbook cargados en el mantenedor (IndexedDB)
//   config  → sedes, perfiles profesionales, códigos habilitados por sede y
//             restricciones de perfiles por código (localStorage, exportable a JSON)
//   catalogo → exámenes armados a partir de los insumos (o el catálogo de ejemplo)

import { reactive, shallowRef, computed, watch } from 'vue'
import { EXAMENES, VOCABULARIO } from './data/examenes'
import { LP } from './data/loinc.js'
import { construirCatalogo } from './utils/construirCatalogo'
import { cargarOCL, cargarPlaybook } from './utils/cargarCatalogo'
import { leerInsumo, guardarInsumo, leerConfig, guardarConfig } from './utils/almacen'

// ---------------------------------------------------------------- insumos y catálogo
export const insumos = shallowRef({ fuente: null, coleccion: null, playbook: null })
export const estado = reactive({ listo: false, cargando: null, error: '' })

export const catalogo = computed(() => {
  const { fuente, coleccion } = insumos.value
  if (!fuente && !coleccion)
    return { examenes: EXAMENES, vocabulario: VOCABULARIO, resumen: { total: EXAMENES.length, enPlaybook: 0, sinFuente: 0 }, ejemplo: true }
  const c = construirCatalogo(insumos.value)
  return { ...c, examenes: Object.freeze(c.examenes), ejemplo: false }
})

// Modalidades ordenadas por nº de exámenes del catálogo ({Imaging modality} al final)
export const vocabulario = computed(() => {
  const { examenes, vocabulario: v } = catalogo.value
  const total = {}
  for (const e of examenes) for (const m of e.modalidades) total[m] = (total[m] || 0) + 1
  const peso = (m) => (m.codigo === LP.IMAGING_MODALITY ? -1 : total[m.codigo] ?? 0)
  return { ...v, modalidades: [...v.modalidades].sort((a, b) => peso(b) - peso(a)) }
})

export async function iniciar() {
  const [fuente, coleccion, playbook] = await Promise.all(['fuente', 'coleccion', 'playbook'].map(leerInsumo))
  insumos.value = { fuente, coleccion, playbook }
  estado.listo = true
}

async function cargarInsumo(etiqueta, tarea) {
  estado.cargando = etiqueta
  estado.error = ''
  try {
    return await tarea()
  } catch (err) {
    estado.error = err.message
    return null
  } finally {
    estado.cargando = null
  }
}

// Zip OCL (fuente o collection): se reconoce por su contenido
export const cargarInsumoOCL = (origen) =>
  cargarInsumo('ocl', async () => {
    const r = await cargarOCL(origen)
    const clave = r.meta.tipo === 'coleccion' ? 'coleccion' : 'fuente'
    insumos.value = { ...insumos.value, [clave]: r }
    await guardarInsumo(clave, r)
    return r
  })

export const cargarInsumoPlaybook = (origen) =>
  cargarInsumo('playbook', async () => {
    const r = await cargarPlaybook(origen)
    insumos.value = { ...insumos.value, playbook: r }
    await guardarInsumo('playbook', r)
    return r
  })

export async function quitarInsumo(clave) {
  insumos.value = { ...insumos.value, [clave]: null }
  await guardarInsumo(clave, null)
}

// ---------------------------------------------------------------- configuración
const CLAVE_CONFIG = 'oa.config.v1'

const PERFILES_BASE = [
  'Medicina general',
  'Medicina familiar',
  'Medicina interna',
  'Medicina de urgencia',
  'Pediatría',
  'Ginecología y obstetricia',
  'Cirugía general',
  'Traumatología y ortopedia',
  'Neurocirugía',
  'Neurología',
  'Cardiología',
  'Enfermedades respiratorias',
  'Gastroenterología',
  'Urología',
  'Oncología',
  'Reumatología',
  'Otorrinolaringología',
  'Oftalmología',
  'Odontología',
  'Matronería'
]

export const slug = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const configInicial = () => ({
  version: 1,
  sedes: [{ id: 'sede-central', nombre: 'Sede central' }],
  perfiles: PERFILES_BASE.map((nombre) => ({ id: slug(nombre), nombre })),
  habilitados: {}, // sedeId → [id de examen]
  restricciones: {} // id de examen → [perfilId]; sin entrada = cualquier perfil
})

function normalizarConfig(c) {
  const base = configInicial()
  if (!c || typeof c !== 'object') return base
  return {
    version: 1,
    sedes: Array.isArray(c.sedes) ? c.sedes.filter((s) => s?.id && s?.nombre) : base.sedes,
    perfiles: Array.isArray(c.perfiles) ? c.perfiles.filter((p) => p?.id && p?.nombre) : base.perfiles,
    habilitados: c.habilitados && typeof c.habilitados === 'object' ? c.habilitados : {},
    restricciones: c.restricciones && typeof c.restricciones === 'object' ? c.restricciones : {}
  }
}

export const config = reactive(normalizarConfig(leerConfig(CLAVE_CONFIG)))
watch(config, (v) => guardarConfig(CLAVE_CONFIG, v), { deep: true })

// Sede y perfil elegidos en cada vista (se recuerdan entre visitas)
const CLAVE_SESION = 'oa.sesion.v1'
export const sesion = reactive({ sedeMantenedor: null, sedeSolicitud: null, perfilSolicitud: null, ...leerConfig(CLAVE_SESION) })
watch(sesion, (v) => guardarConfig(CLAVE_SESION, v), { deep: true })

const nuevoId = (lista, nombre) => {
  const base = slug(nombre) || 'item'
  let id = base
  for (let i = 2; lista.some((x) => x.id === id); i++) id = `${base}-${i}`
  return id
}

// ---- sedes
export function agregarSede(nombre) {
  nombre = nombre.trim()
  if (!nombre) return null
  const id = nuevoId(config.sedes, nombre)
  config.sedes.push({ id, nombre })
  return id
}
export function renombrar(lista, id, nombre) {
  const item = config[lista].find((x) => x.id === id)
  if (item && nombre.trim()) item.nombre = nombre.trim()
}
export function eliminarSede(id) {
  config.sedes = config.sedes.filter((s) => s.id !== id)
  delete config.habilitados[id]
}
// Copia los códigos habilitados de otra sede
export function copiarHabilitados(desde, hacia) {
  config.habilitados[hacia] = [...(config.habilitados[desde] ?? [])]
}

// ---- perfiles
export function agregarPerfil(nombre) {
  nombre = nombre.trim()
  if (!nombre) return null
  const id = nuevoId(config.perfiles, nombre)
  config.perfiles.push({ id, nombre })
  return id
}
// Códigos cuya restricción quedaría vacía (abierta a todos) si se elimina el perfil
export const codigosSoloDePerfil = (id) =>
  Object.entries(config.restricciones).filter(([, ps]) => ps.length === 1 && ps[0] === id).map(([e]) => e)

export function eliminarPerfil(id) {
  config.perfiles = config.perfiles.filter((p) => p.id !== id)
  for (const [examen, ps] of Object.entries(config.restricciones)) {
    const resto = ps.filter((p) => p !== id)
    if (resto.length) config.restricciones[examen] = resto
    else delete config.restricciones[examen]
  }
}

// ---- habilitación por sede
export const habilitadosPorSede = computed(() =>
  Object.fromEntries(config.sedes.map((s) => [s.id, new Set(config.habilitados[s.id] ?? [])]))
)

export function habilitar(sedeId, ids, activo) {
  const actual = new Set(config.habilitados[sedeId] ?? [])
  for (const id of ids) activo ? actual.add(id) : actual.delete(id)
  config.habilitados[sedeId] = [...actual]
}

// ---- restricción por perfil profesional
export const perfilesDe = (examenId) => config.restricciones[examenId] ?? []

export function restringir(ids, perfiles) {
  for (const id of ids) {
    if (perfiles.length) config.restricciones[id] = [...perfiles]
    else delete config.restricciones[id]
  }
}
// Agrega o quita perfiles sin tocar los demás de cada código
export function ajustarPerfiles(ids, perfil, incluir) {
  for (const id of ids) {
    const ps = new Set(config.restricciones[id] ?? [])
    incluir ? ps.add(perfil) : ps.delete(perfil)
    if (ps.size) config.restricciones[id] = [...ps]
    else delete config.restricciones[id]
  }
}

export const puedeSolicitar = (examenId, perfilId) => {
  const ps = config.restricciones[examenId]
  return !ps?.length || (!!perfilId && ps.includes(perfilId))
}

// ---- exportar / importar
export function exportarConfig() {
  const datos = { ...JSON.parse(JSON.stringify(config)), exportado: new Date().toISOString() }
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `codigos-solicitables-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function importarConfig(archivo) {
  const datos = JSON.parse(await archivo.text())
  if (!Array.isArray(datos?.sedes) || !Array.isArray(datos?.perfiles))
    throw new Error('El archivo no es una configuración de códigos solicitables')
  Object.assign(config, normalizarConfig(datos))
}

export function restablecerConfig() {
  Object.assign(config, configInicial())
}
