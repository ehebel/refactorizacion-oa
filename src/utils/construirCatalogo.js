// Arma el catálogo de exámenes combinando los insumos cargados en el mantenedor:
//   fuente    → conceptos OCL con sus mappings (código local, LOINC y atributos LP)
//   coleccion → (opcional) subconjunto de conceptos de la fuente que forman el catálogo
//   playbook  → (opcional) LOINC/RSNA Radiology Playbook indexado por código LOINC
// Si hay Playbook y el LOINC del examen está en él, todos los ejes salen del Playbook;
// si no, modalidad, región y lateralidad salen de los mappings OCL.

import { DEFECTO, REGION_A_PARTE, EJES_PRINCIPALES, EJES_EXTRA, NOMBRE_VISIBLE, construirVocabulario } from '../data/loinc.js'
import { traducir, siglaModalidad } from '../data/es/index.js'

const unicos = (arr) => [...new Set(arr)]

// tipo de Part del Playbook → eje de la interfaz
const EJE_POR_TIPO = {
  ...Object.fromEntries(Object.entries(EJES_PRINCIPALES).map(([clave, tipo]) => [tipo, clave])),
  ...Object.fromEntries(EJES_EXTRA.map((e) => [e.tipo, e.clave]))
}

export function construirCatalogo({ fuente = null, coleccion = null, playbook = null }) {
  // Conceptos del catálogo: los de la collection (completados con la fuente) o los de la fuente
  const porId = new Map((fuente?.conceptos ?? []).map((c) => [c.id, c]))
  const base = coleccion
    ? coleccion.conceptos.map((c) => ({ ...(porId.get(c.id) ?? {}), ...c, ...soloAtributos(porId.get(c.id)) }))
    : fuente?.conceptos ?? []
  const sinFuente = coleccion ? coleccion.conceptos.filter((c) => !porId.has(c.id)).length : 0

  const partePlaybook = (lp) => {
    const p = playbook?.partes[lp]
    if (!p) return null
    const eje = EJE_POR_TIPO[playbook.tipos[p[0]]]
    return eje ? { eje, codigo: lp, nombre: NOMBRE_VISIBLE[lp] ?? p[1], radlex: p[2] } : null
  }

  // LOINC Parts encontrados (código LP → nombre): opciones de los filtros
  const encontrados = {
    modalidad: new Map(),
    region: new Map(),
    lateralidad: new Map(),
    extra: Object.fromEntries(EJES_EXTRA.map((e) => [e.clave, new Map()]))
  }
  const mapaDe = (eje) => encontrados[eje] ?? encontrados.extra[eje]

  let enPlaybook = 0
  const examenes = []
  for (const c of base) {
    const pb = c.loinc && playbook ? playbook.loinc[c.loinc] : null
    if (pb) enPlaybook++

    const ejes = {}
    const agregar = (eje, codigo, nombre) => {
      const lista = (ejes[eje] ??= [])
      if (!lista.includes(codigo)) lista.push(codigo)
      const mapa = mapaDe(eje)
      if (!mapa.has(codigo)) mapa.set(codigo, NOMBRE_VISIBLE[codigo] ?? nombre)
    }
    const partes = pb ? pb[1].map(partePlaybook).filter(Boolean) : []
    for (const p of partes) agregar(p.eje, p.codigo, p.nombre)
    for (const eje of ['modalidad', 'region', 'lateralidad']) {
      if (ejes[eje]) continue
      const respaldo = c[eje]?.length ? c[eje] : [[DEFECTO[eje].codigo, DEFECTO[eje].nombre]]
      for (const [codigo, nombre] of respaldo) agregar(eje, codigo, nombre)
    }

    const { modalidad, region, lateralidad, ...extra } = ejes
    const nombresModalidad = modalidad.map((m) => encontrados.modalidad.get(m))
    examenes.push({
      id: c.id,
      codigo: c.local ?? c.id,
      loinc: c.loinc ?? null,
      nombre: c.nombre,
      nombreEn: c.nombreEn ?? '',
      nombreLoinc: pb?.[0] ?? '',
      // Todos son códigos LP
      modalidades: modalidad,
      regiones: region,
      partes: unicos(region.map((r) => REGION_A_PARTE[r] ?? r)),
      lateralidades: lateralidad,
      ejes: extra,
      // Long Common Name LOINC y nombres de los Parts (inglés, RadLex y español) para la búsqueda
      buscable: [
        pb?.[0] ?? '',
        ...partes.flatMap((p) => [p.nombre, p.radlex, traducir(p.eje, p.nombre)]),
        ...nombresModalidad.map(siglaModalidad),
        ...region.map((r) => traducir('region', encontrados.region.get(r)))
      ].join(' ')
    })
  }
  examenes.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))

  return {
    examenes,
    vocabulario: construirVocabulario(encontrados),
    resumen: { total: examenes.length, enPlaybook, sinFuente }
  }
}

// Atributos de la fuente que una collection no trae
function soloAtributos(c) {
  if (!c) return {}
  const { local, loinc, modalidad, region, lateralidad } = c
  return { local, loinc, modalidad, region, lateralidad }
}
