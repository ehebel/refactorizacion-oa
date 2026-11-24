// Procesa fuera del hilo principal los archivos pesados del mantenedor:
//   { tipo: 'ocl', datos: ArrayBuffer (zip) }       → insumo OCL compacto (fuente o collection)
//   { tipo: 'playbook', datos: string (CSV), version } → índice del Radiology Playbook
import { leerZipOCL } from './ocl.js'
import { parsearPlaybook } from './playbookCsv.js'

self.onmessage = ({ data }) => {
  try {
    const resultado = data.tipo === 'ocl' ? leerZipOCL(data.datos) : parsearPlaybook(data.datos, data.version)
    self.postMessage({ ok: true, resultado })
  } catch (err) {
    self.postMessage({ ok: false, error: err.message || String(err) })
  }
}
