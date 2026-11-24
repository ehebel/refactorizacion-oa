// Persistencia en el navegador.
//   IndexedDB  → insumos grandes (fuente/collection OCL y Playbook)
//   localStorage → configuración del mantenedor (sedes, perfiles, habilitaciones, restricciones)

const BD = 'oa-imagenologia'
const ALMACEN = 'insumos'

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BD, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(ALMACEN)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function transaccion(modo, fn) {
  const db = await abrir()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN, modo)
    const req = fn(tx.objectStore(ALMACEN))
    tx.oncomplete = () => {
      db.close()
      resolve(req?.result)
    }
    tx.onerror = tx.onabort = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function leerInsumo(clave) {
  try {
    return (await transaccion('readonly', (s) => s.get(clave))) ?? null
  } catch {
    return null
  }
}
export const guardarInsumo = (clave, valor) =>
  transaccion('readwrite', (s) => (valor == null ? s.delete(clave) : s.put(valor, clave))).catch(() => {})

export function leerConfig(clave) {
  try {
    const t = localStorage.getItem(clave)
    return t ? JSON.parse(t) : null
  } catch {
    return null
  }
}
export function guardarConfig(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    /* sin almacenamiento disponible: la configuración vive solo en esta sesión */
  }
}
