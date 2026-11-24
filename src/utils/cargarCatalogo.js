// Carga de insumos del mantenedor: zips OCL (fuente o collection) y el CSV del Playbook,
// ya sea desde la carpeta del proyecto (servida por Vite) o desde un archivo elegido.
import { versionDesdeRuta } from './playbookCsv.js'

// Archivos conocidos en la carpeta del proyecto
export const ZIPS_OCL = [
  {
    archivo: 'orgs_MINSALQA_sources_manualimagenes_v0.0.1_2026-08-20_204515.zip',
    etiqueta: 'Fuente · Manual de Imagenología (manualimagenes v0.0.1)'
  },
  {
    archivo: 'orgs_MINSALQA_collections_ordenatencion_v0.0.1_autoexpand-v0.0.1_2026-09-14_201439.zip',
    etiqueta: 'Collection · Órdenes de Atención (ordenatencion v0.0.1)'
  }
]
export const CSV_PLAYBOOK = 'Loinc_2.83/AccessoryFiles/LoincRsnaRadiologyPlaybook/LoincRsnaRadiologyPlaybook.csv'

function enWorker(mensaje, transferir = []) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./catalogo.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      worker.terminate()
      data.ok ? resolve(data.resultado) : reject(new Error(data.error))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message || 'Error al procesar el archivo'))
    }
    worker.postMessage(mensaje, transferir)
  })
}

async function leerDeCarpeta(ruta) {
  const url = `${import.meta.env.BASE_URL}${ruta.split('/').map(encodeURIComponent).join('/')}`
  const resp = await fetch(url)
  const tipo = resp.headers.get('content-type') || ''
  if (!resp.ok || tipo.includes('text/html')) throw new Error(`No se encontró «${ruta}» en la carpeta del proyecto`)
  return resp
}

export async function cargarOCL(origen) {
  const buffer = typeof origen === 'string' ? await (await leerDeCarpeta(origen)).arrayBuffer() : await origen.arrayBuffer()
  return enWorker({ tipo: 'ocl', datos: buffer }, [buffer])
}

export async function cargarPlaybook(origen) {
  const esRuta = typeof origen === 'string'
  const texto = esRuta ? await (await leerDeCarpeta(origen)).text() : await origen.text()
  return enWorker({ tipo: 'playbook', datos: texto, version: versionDesdeRuta(esRuta ? origen : origen.name) })
}
