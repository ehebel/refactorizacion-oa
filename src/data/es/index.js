// Traducción al español de los LOINC Parts del Radiology Playbook, por eje de la interfaz.
// Si un Part no tiene traducción se muestra su nombre LOINC en inglés.
import { REGIONES, LATERALIDADES, FOCOS } from './anatomia.js'
import { MODALIDADES, MODALIDADES_LARGO, SUBTIPOS, TIMING, SUSTANCIAS, VIAS, AGREGACION_VISTAS, TIPOS_VISTA, MANIOBRAS } from './tecnica.js'
import { GUIA_ACCION, GUIA_ABORDAJE, GUIA_OBJETO, MOTIVOS, SUJETOS } from './procedimientos.js'

const POR_EJE = {
  modalidad: MODALIDADES_LARGO,
  region: REGIONES,
  lateralidad: LATERALIDADES,
  foco: FOCOS,
  subtipo: SUBTIPOS,
  timing: TIMING,
  sustancia: SUSTANCIAS,
  via: VIAS,
  guiaAccion: GUIA_ACCION,
  guiaObjeto: GUIA_OBJETO,
  guiaAbordaje: GUIA_ABORDAJE,
  vistas: AGREGACION_VISTAS,
  tipoVista: TIPOS_VISTA,
  maniobra: MANIOBRAS,
  motivo: MOTIVOS,
  sujeto: SUJETOS
}

// Nombre en español de un Part según su eje (o el nombre en inglés si no hay traducción)
export const traducir = (eje, nombreEn) => POR_EJE[eje]?.[nombreEn] ?? nombreEn

// Sigla en español de una modalidad (RX, TC, RM, ECO…)
export const siglaModalidad = (nombreEn) => MODALIDADES[nombreEn] ?? nombreEn
