import { traducir, siglaModalidad } from './es/index.js'

// Códigos LOINC Part (LP) que la interfaz necesita conocer para su lógica
// (figura humana, reglas de lateralidad y agrupaciones). Las OPCIONES de los filtros
// no salen de aquí: se extraen de los LP presentes en el catálogo cargado.

export const LP = {
  // Regiones (has-region-imaged)
  ABDOMEN: 'LP199956-6',
  BREAST: 'LP199961-6',
  CEREBRAL_ARTERY_MIDDLE: 'LP208562-1',
  CHEST: 'LP199962-4',
  EXTREMITY: 'LP199969-9',
  HEAD: 'LP199977-2',
  LOWER_EXTREMITY: 'LP199985-5',
  NECK: 'LP199995-4',
  PELVIS: 'LP199998-8',
  UNSPECIFIED_REGION: 'LP213584-8',
  UPPER_EXTREMITY: 'LP200031-5',
  WHOLE_BODY: 'LP200036-4',
  UMBILICAL_ARTERY: 'LP208556-3',
  UMBILICAL_CORD: 'LP208557-1',
  UMBILICAL_VESSELS: 'LP208561-3',
  // Lateralidad (has-laterality)
  BILATERAL: 'LP199951-7',
  LEFT: 'LP199952-5',
  RIGHT: 'LP199953-3',
  UNILATERAL: 'LP207061-5',
  UNSPECIFIED_LAT: 'LP199955-8',
  // Modalidad genérica (has-modality)
  IMAGING_MODALITY: 'LP263423-8'
}

// Valores por defecto cuando un concepto no trae el mapping correspondiente
export const DEFECTO = {
  modalidad: { codigo: LP.IMAGING_MODALITY, nombre: '{Imaging modality}' },
  region: { codigo: LP.UNSPECIFIED_REGION, nombre: 'Unspecified region imaged' },
  lateralidad: { codigo: LP.UNSPECIFIED_LAT, nombre: 'Unspecified' }
}

// Regiones que se agrupan dentro de otra parte al filtrar (umbilicales → Abdomen)
export const REGION_A_PARTE = {
  [LP.UMBILICAL_ARTERY]: LP.ABDOMEN,
  [LP.UMBILICAL_CORD]: LP.ABDOMEN,
  [LP.UMBILICAL_VESSELS]: LP.ABDOMEN
}

// Partes que contienen a otras al filtrar
export const SUBPARTES = {
  [LP.EXTREMITY]: [LP.UPPER_EXTREMITY, LP.LOWER_EXTREMITY]
}

// Lados concretos que puede tomar un examen "Unilateral" al solicitarlo
export const LADOS = [LP.LEFT, LP.RIGHT]

// Color de cada modalidad LP (clase CSS mod-*). Los LP no listados usan OTRA.
const GRUPO_MODALIDAD = {
  'LP212285-3': 'RX', // XR
  'LP200067-9': 'TC', // CT
  'LP206549-0': 'RM', // MR
  'LP220472-7': 'FL', // Radio fluoroscopy
  'LP207608-3': 'ECO', // US
  'LP208891-4': 'MN', // NM
  'LP208694-2': 'MN', // PT+CT
  'LP208893-0': 'MN', // PT
  'LP234845-8': 'MN', // NM.SPECT+CT
  'LP208647-0': 'MG', // Mammogram
  'LP208571-2': 'DXA' // Dual Energy X-ray Absorptiometry (DXA)
}
export const claseModalidad = (codigo) => `mod-${GRUPO_MODALIDAD[codigo] ?? 'OTRA'}`


// Ejes del LOINC/RSNA Radiology Playbook. Los tres primeros son los filtros principales
// (óvalos, Body part y Laterality); el resto son filtros adicionales.
export const EJES_PRINCIPALES = {
  modalidad: 'Rad.Modality.Modality Type',
  region: 'Rad.Anatomic Location.Region Imaged',
  lateralidad: 'Rad.Anatomic Location.Laterality'
}
export const EJES_EXTRA = [
  { clave: 'foco', tipo: 'Rad.Anatomic Location.Imaging Focus', titulo: 'Foco anatómico', destacado: true, orden: 'alfabetico' },
  { clave: 'subtipo', tipo: 'Rad.Modality.Modality Subtype', titulo: 'Subtipo de modalidad', destacado: true },
  { clave: 'timing', tipo: 'Rad.Timing', titulo: 'Contraste / tiempo', destacado: true },
  { clave: 'sustancia', tipo: 'Rad.Pharmaceutical.Substance Given', titulo: 'Sustancia administrada', destacado: true },
  { clave: 'via', tipo: 'Rad.Pharmaceutical.Route', titulo: 'Vía de administración' },
  { clave: 'guiaAccion', tipo: 'Rad.Guidance for.Action', titulo: 'Procedimiento guiado' },
  { clave: 'guiaObjeto', tipo: 'Rad.Guidance for.Object', titulo: 'Objeto del procedimiento' },
  { clave: 'guiaAbordaje', tipo: 'Rad.Guidance for.Approach', titulo: 'Abordaje' },
  { clave: 'vistas', tipo: 'Rad.View.Aggregation', titulo: 'Número de proyecciones' },
  { clave: 'tipoVista', tipo: 'Rad.View.View Type', titulo: 'Tipo de proyección' },
  { clave: 'maniobra', tipo: 'Rad.Maneuver.Maneuver Type', titulo: 'Maniobra' },
  { clave: 'motivo', tipo: 'Rad.Reason for Exam', titulo: 'Motivo del examen' },
  { clave: 'sujeto', tipo: 'Rad.Subject', titulo: 'Sujeto' }
]

// Nombres del Playbook que se muestran distinto (XXX = región no especificada)
export const NOMBRE_VISIBLE = { [LP.UNSPECIFIED_REGION]: 'Unspecified region imaged' }

// Construye el vocabulario de filtros a partir de los LP encontrados en el catálogo.
// `encontrados` = { modalidad: Map(codigo→nombre), region: Map, lateralidad: Map, extra: { clave: Map } }
export function construirVocabulario(encontrados) {
  const { extra = {}, ...principales } = encontrados
  // Nombres en español por código LP (y el original en inglés de LOINC)
  const nombres = {}
  const nombresEn = {}
  const anotar = (eje, mapa) => {
    for (const [c, n] of mapa) {
      nombresEn[c] = n
      nombres[c] = traducir(eje, n)
    }
  }
  for (const [eje, mapa] of Object.entries(principales)) anotar(eje, mapa)
  for (const [eje, mapa] of Object.entries(extra)) anotar(eje, mapa)

  const orden = (a, b) => a.nombre.localeCompare(b.nombre, 'es')
  const lista = (mapa) =>
    [...mapa.keys()].map((codigo) => ({ codigo, nombre: nombres[codigo], nombreEn: nombresEn[codigo] })).sort(orden)

  // Las regiones agrupadas (umbilicales) no se ofrecen aparte: quedan dentro de su parte
  const regiones = new Map([...encontrados.region].filter(([c]) => !REGION_A_PARTE[c]))
  const agrupadas = {} // parte → [códigos agrupados en ella]
  for (const [c] of encontrados.region) {
    const destino = REGION_A_PARTE[c]
    if (!destino) continue
    if (!regiones.has(destino)) {
      regiones.set(destino, 'Abdomen')
      nombres[destino] ??= 'Abdomen'
    }
    ;(agrupadas[destino] ??= []).push(c)
  }

  return {
    nombres,
    nombresEn,
    modalidades: lista(encontrados.modalidad).map((m) => ({
      ...m,
      corto: siglaModalidad(m.nombreEn),
      clase: claseModalidad(m.codigo)
    })),
    partes: lista(regiones).map((p) => ({ ...p, incluye: (agrupadas[p.codigo] ?? []).map((c) => nombres[c]) })),
    lateralidades: lista(encontrados.lateralidad),
    // Filtros adicionales del Playbook (solo los ejes presentes en el catálogo)
    ejes: EJES_EXTRA.filter((e) => extra[e.clave]?.size).map((e) => ({ ...e, opciones: lista(extra[e.clave]) }))
  }
}
