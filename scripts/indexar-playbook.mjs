// Genera src/data/playbook.json (índice precalculado del Radiology Playbook) a partir del CSV.
// La aplicación carga el CSV en el mantenedor; este índice sirve para pruebas o integraciones.
// Uso: npm run playbook [-- ruta/al/LoincRsnaRadiologyPlaybook.csv]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parsearPlaybook, versionDesdeRuta } from '../src/utils/playbookCsv.js'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const csv = process.argv[2] ?? resolve(raiz, 'Loinc_2.83/AccessoryFiles/LoincRsnaRadiologyPlaybook/LoincRsnaRadiologyPlaybook.csv')
const indice = parsearPlaybook(readFileSync(csv, 'utf8'), versionDesdeRuta(csv))
const salida = resolve(raiz, 'src/data/playbook.json')
writeFileSync(salida, JSON.stringify(indice))
console.log(`Playbook ${indice.version}: ${Object.keys(indice.loinc).length} términos LOINC, ${Object.keys(indice.partes).length} LOINC Parts → ${salida}`)
