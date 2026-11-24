// Lee el LOINC/RSNA Radiology Playbook (LoincRsnaRadiologyPlaybook.csv) y lo indexa por
// código LOINC. Formato del índice:
//   version  → versión de LOINC (si se puede deducir)
//   tipos    → PartTypeName incluidos
//   partes   → { LP: [índiceTipo, PartName, PreferredName (RadLex)] }
//   loinc    → { LoincNumber: [LongCommonName, [LP, ...]] }

// Tipos sin valor para filtrar (solo indican presencia)
const EXCLUIDOS = new Set(['Rad.Anatomic Location.Laterality.Presence', 'Rad.Guidance for.Presence'])
const COLUMNAS = ['LoincNumber', 'LongCommonName', 'PartNumber', 'PartTypeName', 'PartName', 'PreferredName']

// CSV con comillas dobles (los campos pueden contener comas y comillas escapadas)
function* filas(texto) {
  let campo = ''
  let fila = []
  let comillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') comillas = false
      else campo += c
    } else if (c === '"') comillas = true
    else if (c === ',') {
      fila.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo)
      campo = ''
      if (fila.length > 1 || fila[0]) yield fila
      fila = []
    } else campo += c
  }
  if (campo || fila.length) {
    fila.push(campo)
    yield fila
  }
}

export function parsearPlaybook(texto, version = null) {
  const it = filas(texto.replace(/^﻿/, ''))
  const cab = it.next().value ?? []
  const col = Object.fromEntries(cab.map((n, i) => [n.trim(), i]))
  const faltan = COLUMNAS.filter((c) => col[c] === undefined)
  if (faltan.length) throw new Error(`El CSV no es el Radiology Playbook (faltan columnas: ${faltan.join(', ')})`)

  const tipos = []
  const idxTipo = new Map()
  const partes = {}
  const loinc = {}
  for (const f of it) {
    const tipo = f[col.PartTypeName]
    if (!tipo || EXCLUIDOS.has(tipo)) continue
    if (!idxTipo.has(tipo)) {
      idxTipo.set(tipo, tipos.length)
      tipos.push(tipo)
    }
    const lp = f[col.PartNumber]
    partes[lp] ??= [idxTipo.get(tipo), f[col.PartName], f[col.PreferredName]]
    const reg = (loinc[f[col.LoincNumber]] ??= [f[col.LongCommonName], []])
    if (!reg[1].includes(lp)) reg[1].push(lp)
  }
  if (!Object.keys(loinc).length) throw new Error('El CSV del Playbook no contiene términos')
  return { version, tipos, partes, loinc }
}

// Deduce la versión de LOINC desde una ruta tipo ".../Loinc_2.83/..."
export const versionDesdeRuta = (ruta) => ruta.match(/Loinc_([\d.]+)/i)?.[1] ?? null
