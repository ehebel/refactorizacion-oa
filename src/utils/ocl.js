// Lectura de exportaciones OCL (Open Concept Lab): Source Version o Collection Version.
// Devuelve un insumo compacto y serializable (se guarda en el navegador y se recombina
// con el Playbook en construirCatalogo.js).
//
// Source (p. ej. manualimagenes): conceptos + mappings
//   SAME-AS (CL-RX)    → código local
//   SAME-AS (LOINC)    → código LOINC (llave para cruzar con el Playbook)
//   has-modality / has-region-imaged / has-laterality → atributos LP de respaldo
// Collection (p. ej. ordenatencion): subconjunto de conceptos de una fuente, sin mappings;
//   sus atributos se toman de la fuente cargada.

import { unzipSync, strFromU8 } from 'fflate'

const TIPO_OCL = { 'has-modality': 'modalidad', 'has-region-imaged': 'region', 'has-laterality': 'lateralidad' }

export function leerZipOCL(buffer) {
  const archivos = unzipSync(new Uint8Array(buffer))
  const nombreJson = Object.keys(archivos).find((n) => n.toLowerCase().endsWith('.json'))
  if (!nombreJson) throw new Error('El zip no contiene un archivo .json de exportación OCL')
  return convertirExportOCL(JSON.parse(strFromU8(archivos[nombreJson])))
}

const nombreLocale = (c, locale) =>
  c.names?.find((n) => n.locale === locale && n.locale_preferred && !n.retired)?.name ??
  c.names?.find((n) => n.locale === locale && !n.retired)?.name ??
  null

export function convertirExportOCL(exp) {
  if (!Array.isArray(exp.concepts))
    throw new Error('El JSON no tiene el formato de exportación OCL (faltan los conceptos)')
  const esColeccion = /collection/i.test(exp.type ?? '') || !!exp.collection_type

  const meta = {
    tipo: esColeccion ? 'coleccion' : 'fuente',
    codigo: exp.short_code ?? exp.id,
    nombre: exp.full_name || exp.name || exp.short_code,
    organizacion: exp.owner,
    version: exp.version ?? exp.id,
    fecha: exp.updated_on ?? exp.created_on,
    // Fuente(s) de origen de los conceptos (para una collection)
    origen: [...new Set(exp.concepts.map((c) => c.source).filter(Boolean))]
  }

  // Atributos por concepto, desde los mappings (solo las fuentes los traen)
  const attrs = new Map()
  for (const m of exp.mappings ?? []) {
    if (m.retired) continue
    let a = attrs.get(m.from_concept_code)
    if (!a) attrs.set(m.from_concept_code, (a = {}))
    if (m.map_type === 'SAME-AS') {
      if (m.to_source_name === 'LOINC') a.loinc = m.to_concept_code
      else a.local = m.to_concept_code
    } else if (TIPO_OCL[m.map_type] && String(m.to_concept_code).startsWith('LP')) {
      ;(a[TIPO_OCL[m.map_type]] ??= []).push([
        m.to_concept_code,
        m.to_concept_name_resolved ?? m.to_concept_name ?? m.to_concept_code
      ])
    }
  }

  const conceptos = []
  for (const c of exp.concepts) {
    if (c.retired) continue
    conceptos.push({
      id: c.id,
      nombre: nombreLocale(c, 'es') ?? c.display_name,
      nombreEn: nombreLocale(c, 'en') ?? '',
      clase: c.concept_class,
      ...(attrs.get(c.id) ?? {})
    })
  }
  if (!conceptos.length) throw new Error('La exportación no contiene conceptos vigentes')
  return { meta, conceptos }
}
