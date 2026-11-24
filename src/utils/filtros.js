import { LP, SUBPARTES } from '../data/loinc.js'

// Todos los filtros usan códigos LOINC Part (LP…)

// Normaliza un texto carácter a carácter (sin tildes, minúsculas) conservando
// la longitud original, para poder resaltar coincidencias sobre el texto real.
export function normalizar(texto) {
  return [...texto]
    .map((c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()[0] ?? c)
    .join('')
}

// Los exámenes pueden tener varias partes, modalidades y lateralidades (basta que una coincida).
export function cumpleParte(examen, parte) {
  if (!parte) return true
  const incluidas = [parte, ...(SUBPARTES[parte] ?? [])]
  return examen.partes.some((p) => incluidas.includes(p))
}

// Left/Right incluyen también los exámenes "Unilateral" (el lado se indica al solicitar).
export function cumpleLateralidad(examen, lateralidad) {
  if (!lateralidad) return true
  const l = examen.lateralidades
  if (lateralidad === LP.LEFT || lateralidad === LP.RIGHT) return l.includes(lateralidad) || l.includes(LP.UNILATERAL)
  return l.includes(lateralidad)
}

// Filtros adicionales del Playbook: { eje: códigoLP } (todos deben cumplirse)
export function cumpleExtras(examen, extras) {
  for (const eje in extras) {
    const v = extras[eje]
    if (v && !examen.ejes?.[eje]?.includes(v)) return false
  }
  return true
}

export function filtrarExamenes(examenes, { modalidades = [], parte = null, lateralidad = null, extras = {} }) {
  return examenes.filter(
    (e) =>
      (modalidades.length === 0 || e.modalidades.some((m) => modalidades.includes(m))) &&
      cumpleParte(e, parte) &&
      cumpleLateralidad(e, lateralidad) &&
      cumpleExtras(e, extras)
  )
}

// Nº de exámenes por opción de cada eje adicional, aplicando todos los demás filtros
// (búsqueda facetada: cada combo muestra solo lo que todavía es alcanzable).
export function conteoPorEje(examenes, filtros, ejes) {
  const base = filtrarExamenes(examenes, { ...filtros, extras: {} })
  const resultado = {}
  for (const { clave } of ejes) {
    const otros = { ...filtros.extras, [clave]: null }
    const c = (resultado[clave] = {})
    for (const e of base) {
      if (!cumpleExtras(e, otros)) continue
      for (const v of e.ejes?.[clave] ?? []) c[v] = (c[v] || 0) + 1
    }
  }
  return resultado
}

// Texto de búsqueda normalizado (se calcula una vez por examen)
const cacheTexto = new WeakMap()
function textoBusqueda(e) {
  let t = cacheTexto.get(e)
  if (t === undefined) {
    t = normalizar(`${e.nombre} ${e.nombreEn} ${e.codigo} ${e.loinc ?? ''} ${e.buscable ?? ''}`)
    cacheTexto.set(e, t)
  }
  return t
}

// Exámenes "Unilateral" sin lado concreto: el lado se indica al solicitar
export const requiereLado = (e) =>
  e.lateralidades.includes(LP.UNILATERAL) && !e.lateralidades.some((l) => [LP.LEFT, LP.RIGHT, LP.BILATERAL].includes(l))

// Cada palabra de la consulta debe aparecer en el nombre (es/en), códigos, modalidad o región.
export function buscarTexto(examenes, consulta) {
  const tokens = normalizar(consulta).split(/\s+/).filter(Boolean)
  if (!tokens.length) return examenes
  return examenes.filter((e) => {
    const heno = textoBusqueda(e)
    return tokens.every((t) => heno.includes(t))
  })
}

// Devuelve segmentos [{texto, marca}] para resaltar las coincidencias en `texto`.
export function resaltar(texto, consulta) {
  const tokens = normalizar(consulta).split(/\s+/).filter(Boolean)
  const norm = normalizar(texto)
  const marcas = new Array(texto.length).fill(false)
  for (const t of tokens) {
    let i = norm.indexOf(t)
    while (i !== -1) {
      for (let k = i; k < i + t.length; k++) marcas[k] = true
      i = norm.indexOf(t, i + t.length)
    }
  }
  const segmentos = []
  for (let i = 0; i < texto.length; i++) {
    const ultimo = segmentos[segmentos.length - 1]
    if (ultimo && ultimo.marca === marcas[i]) ultimo.texto += texto[i]
    else segmentos.push({ texto: texto[i], marca: marcas[i] })
  }
  return segmentos
}
