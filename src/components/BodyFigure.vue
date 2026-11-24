<script setup>
import { ref, computed } from 'vue'
import { LP, SUBPARTES } from '../data/loinc.js'

// Parte y lateralidad seleccionadas (códigos LOINC Part)
const parte = defineModel('parte', { type: String, default: null })
const lateralidad = defineModel('lateralidad', { type: String, default: null })

const props = defineProps({
  // Body parts y lateralidades (LP) extraídas del catálogo cargado
  vocabulario: { type: Object, required: true },
  // nº de exámenes por parte (según modalidad y lateralidad) y por lateralidad (según modalidad y parte)
  conteo: { type: Object, default: () => ({}) },
  conteoLat: { type: Object, default: () => ({}) }
})

const hover = ref(null)
const ANCHO = 240
const ALTO = 470
const nombre = (c) => props.vocabulario.nombres[c] ?? c

// ---- Geometría por LOINC Part ----
// Las zonas laterales se definen para el lado IZQUIERDO DEL OBSERVADOR (= Right del paciente
// en vista anterior) y se espejan para el otro lado.
const GEOMETRIA = {
  [LP.HEAD]: {
    formas: [{ tipo: 'path', a: { d: 'M120,10 C141,10 146,28 146,42 C146,60 134,72 120,72 C106,72 94,60 94,42 C94,28 99,10 120,10 Z' } }]
  },
  [LP.CEREBRAL_ARTERY_MIDDLE]: {
    lateral: true,
    arteria: true,
    formas: [{ tipo: 'path', a: { d: 'M112,30 Q102,34 104,44 Q106,50 101,56', fill: 'none' } }]
  },
  [LP.NECK]: {
    formas: [{ tipo: 'path', a: { d: 'M109,70 L131,70 L133,90 L107,90 Z' } }]
  },
  [LP.CHEST]: {
    formas: [{ tipo: 'path', a: { d: 'M107,90 L133,90 Q156,92 164,100 L162,170 L78,170 L76,100 Q84,92 107,90 Z' } }]
  },
  [LP.BREAST]: {
    lateral: true,
    formas: [{ tipo: 'path', a: { d: 'M88,124 Q90,112 102,112 Q114,112 116,124 Q114,140 102,140 Q90,140 88,124 Z' } }]
  },
  [LP.ABDOMEN]: {
    formas: [{ tipo: 'path', a: { d: 'M78,170 L162,170 L160,228 L80,228 Z' } }]
  },
  [LP.PELVIS]: {
    formas: [{ tipo: 'path', a: { d: 'M80,228 L160,228 Q162,252 150,262 L120,278 L90,262 Q78,252 80,228 Z' } }]
  },
  [LP.UPPER_EXTREMITY]: {
    lateral: true,
    formas: [
      { tipo: 'path', a: { d: 'M76,100 Q60,98 56,116 L48,170 L64,174 L74,128 Z' } }, // hombro y brazo
      { tipo: 'path', a: { d: 'M48,174 L64,178 L58,236 L42,234 Z' } }, // antebrazo
      { tipo: 'path', a: { d: 'M42,236 L58,238 Q62,252 56,264 Q48,270 40,262 Q36,250 42,236 Z' } } // mano
    ]
  },
  [LP.LOWER_EXTREMITY]: {
    lateral: true,
    formas: [
      { tipo: 'path', a: { d: 'M82,256 L118,280 L114,350 L88,350 Q80,300 82,256 Z' } }, // cadera y muslo
      { tipo: 'path', a: { d: 'M88,352 L114,352 L110,428 L92,428 Z' } }, // pierna
      { tipo: 'path', a: { d: 'M92,430 L110,430 L112,446 Q100,454 82,450 Q84,440 92,430 Z' } } // pie
    ]
  }
}

function espejar(f) {
  // reflejo horizontal respecto al eje central de la figura
  return { ...f, a: { ...f.a, transform: `translate(${ANCHO},0) scale(-1,1)` } }
}

// Vista anterior: el lado izquierdo del observador es el lado derecho (Right) del paciente
const lados = { izq: LP.RIGHT, der: LP.LEFT }

const codigosPartes = computed(() => new Set(props.vocabulario.partes.map((p) => p.codigo)))

// Zonas dibujadas: solo las body parts presentes en el catálogo que tienen geometría
const zonas = computed(() =>
  Object.entries(GEOMETRIA)
    .filter(([codigo]) => codigosPartes.value.has(codigo))
    .flatMap(([codigo, g]) =>
      g.lateral
        ? [
            { ...g, parte: codigo, id: `${codigo}-izq`, lado: lados.izq },
            { ...g, parte: codigo, formas: g.formas.map(espejar), id: `${codigo}-der`, lado: lados.der }
          ]
        : [{ ...g, parte: codigo, id: codigo, lado: null }]
    )
    // las arterias se dibujan encima de la cabeza
    .sort((a, b) => (a.arteria ? 1 : 0) - (b.arteria ? 1 : 0))
)

// Silueta del cuerpo (todas las formas) → Whole Body, si existe en el catálogo
const siluetaFormas = Object.values(GEOMETRIA)
  .filter((g) => !g.arteria)
  .flatMap((g) => (g.lateral ? [...g.formas, ...g.formas.map(espejar)] : g.formas))
const hayWholeBody = computed(() => codigosPartes.value.has(LP.WHOLE_BODY))

// Body parts del catálogo sin zona propia en la figura (Extremity, Unspecified region…)
const partesSinZona = computed(() =>
  props.vocabulario.partes.filter((p) => !GEOMETRIA[p.codigo] && p.codigo !== LP.WHOLE_BODY)
)

// ---- Selección ----
const LATERALES_CONCRETAS = [LP.LEFT, LP.RIGHT]
const cubre = (sel, p) => sel === p || sel === LP.WHOLE_BODY || (SUBPARTES[sel] ?? []).includes(p)

function estaActiva(z) {
  if (!parte.value || !cubre(parte.value, z.parte)) return false
  if (!z.lado) return true
  return LATERALES_CONCRETAS.includes(lateralidad.value) ? lateralidad.value === z.lado : true
}

// Zonas laterales que al seleccionarse marcan ambos lados por defecto
const AMBOS_LADOS_AL_INICIO = [LP.BREAST]

const opuesto = (lado) => (lado === LP.RIGHT ? LP.LEFT : LP.RIGHT)

function clic(z) {
  if (!z.lado) {
    // Estructura central: alterna la parte; la lateralidad deja de aplicar
    parte.value = parte.value === z.parte ? null : z.parte
    lateralidad.value = null
    return
  }
  const lat = lateralidad.value
  if (parte.value !== z.parte) {
    parte.value = z.parte
    // Mama: el primer clic marca ambas; luego cada lado se puede desmarcar por separado
    lateralidad.value = AMBOS_LADOS_AL_INICIO.includes(z.parte) ? LP.BILATERAL : z.lado
  } else if (lat === z.lado) {
    parte.value = null
    lateralidad.value = null
  } else if (lat === LP.BILATERAL) {
    lateralidad.value = opuesto(z.lado) // se quita este lado
  } else if (lat === opuesto(z.lado)) {
    lateralidad.value = LP.BILATERAL // se suma el lado contrario
  } else {
    lateralidad.value = z.lado
  }
}

function alternarParte(p) {
  parte.value = parte.value === p ? null : p
  if (p === LP.WHOLE_BODY) lateralidad.value = null
}
const alternarLat = (l) => (lateralidad.value = lateralidad.value === l ? null : l)

// ---- Textos ----
const cuenta = (n) => `${n} ${n === 1 ? 'examen' : 'exámenes'}`
const textoHover = computed(() => {
  const z = hover.value
  if (!z) return null
  return `${nombre(z.parte)}${z.lado ? ` · ${nombre(z.lado)}` : ''} · ${cuenta(props.conteo[z.parte] ?? 0)}`
})
const resumen = computed(() => {
  if (!parte.value && !lateralidad.value) return 'Haga clic en una zona del cuerpo para filtrar'
  return [parte.value && nombre(parte.value), lateralidad.value && nombre(lateralidad.value)].filter(Boolean).join(' · ')
})
</script>

<template>
  <div class="figura">
    <svg :viewBox="`0 0 ${ANCHO} ${ALTO}`" class="cuerpo" role="img" aria-label="Figura humana interactiva (vista anterior)">
      <text x="10" y="22" class="lado-txt">D</text>
      <text :x="ANCHO - 10" y="22" class="lado-txt" text-anchor="end">I</text>

      <!-- Silueta: Whole Body -->
      <g
        v-if="hayWholeBody"
        class="silueta"
        :class="{ activa: parte === LP.WHOLE_BODY, hover: hover?.id === 'silueta', vacia: !(conteo[LP.WHOLE_BODY] > 0) }"
        role="button"
        tabindex="0"
        :aria-label="nombre(LP.WHOLE_BODY)"
        :aria-pressed="parte === LP.WHOLE_BODY"
        @click="alternarParte(LP.WHOLE_BODY)"
        @keydown.enter.prevent="alternarParte(LP.WHOLE_BODY)"
        @mouseenter="hover = { id: 'silueta', parte: LP.WHOLE_BODY, lado: null }"
        @mouseleave="hover = null"
      >
        <component :is="f.tipo" v-for="(f, i) in siluetaFormas" :key="i" v-bind="f.a" />
      </g>

      <g
        v-for="z in zonas"
        :key="z.id"
        class="zona"
        :class="{
          activa: estaActiva(z),
          vacia: !(conteo[z.parte] > 0),
          arteria: z.arteria,
          hover: hover?.id === z.id
        }"
        tabindex="0"
        role="button"
        :aria-label="z.lado ? `${nombre(z.parte)} ${nombre(z.lado)}` : nombre(z.parte)"
        :aria-pressed="estaActiva(z)"
        @click="clic(z)"
        @keydown.enter.prevent="clic(z)"
        @keydown.space.prevent="clic(z)"
        @mouseenter="hover = z"
        @mouseleave="hover = null"
        @focus="hover = z"
        @blur="hover = null"
      >
        <component :is="f.tipo" v-for="(f, i) in z.formas" :key="i" v-bind="f.a" />
      </g>

      <!-- detalles decorativos (no interactivos) -->
      <g class="deco">
        <circle cx="112" cy="38" r="2.3" /><circle cx="128" cy="38" r="2.3" />
        <path d="M113,54 Q120,59 127,54" />
        <circle cx="120" cy="206" r="2.2" class="ombligo" />
      </g>
    </svg>

    <p class="estado" :class="{ hover: textoHover }">{{ textoHover ?? resumen }}</p>

    <!-- Body parts sin zona en la figura -->
    <div v-if="partesSinZona.length" class="grupo">
      <span class="titulo">Otras partes del cuerpo</span>
      <div class="botones">
        <button
          v-for="p in partesSinZona"
          :key="p.codigo"
          :class="{ on: parte === p.codigo, cero: !(conteo[p.codigo] > 0) }"
          :title="`${p.nombreEn} · ${p.codigo}`"
          @click="alternarParte(p.codigo)"
        >
          {{ p.nombre }} <small>{{ conteo[p.codigo] ?? 0 }}</small>
        </button>
      </div>
    </div>

    <!-- Lateralidades del catálogo -->
    <div class="grupo">
      <span class="titulo">Lateralidad</span>
      <div class="botones">
        <button
          v-for="l in vocabulario.lateralidades"
          :key="l.codigo"
          :class="{ on: lateralidad === l.codigo, cero: !(conteoLat[l.codigo] > 0) }"
          :title="`${l.nombreEn} · ${l.codigo}`"
          @click="alternarLat(l.codigo)"
        >
          {{ l.nombre }} <small>{{ conteoLat[l.codigo] ?? 0 }}</small>
        </button>
      </div>
    </div>

    <p class="ayuda">
      Clic en un lado: filtra esa lateralidad (en mama, ambas) · clic en el lado opuesto: Bilateral · clic de nuevo: quita el filtro<template
        v-if="hayWholeBody"
      > · clic en el contorno: {{ nombre(LP.WHOLE_BODY) }}</template>
    </p>
  </div>
</template>

<style scoped>
.figura { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.cuerpo { width: 100%; max-width: 260px; height: auto; user-select: none; }
.lado-txt { font-size: 15px; font-weight: 700; fill: var(--texto-suave); }

/* Silueta (Whole Body): las mismas formas con un trazo grueso forman el contorno */
.silueta { cursor: pointer; outline: none; }
.silueta > * { fill: #c9d5e4; stroke: #c9d5e4; stroke-width: 9; stroke-linejoin: round; transition: fill .15s, stroke .15s; }
.silueta.hover > *, .silueta:focus-visible > * { fill: #a9c4ea; stroke: #a9c4ea; }
.silueta.activa > * { fill: var(--primario); stroke: var(--primario); }
.silueta.vacia { opacity: .5; }

.zona { cursor: pointer; outline: none; transition: opacity .15s; }
.zona > * { fill: #eef3f9; stroke: #8fa3bd; stroke-width: 1.3; stroke-linejoin: round; transition: fill .15s, stroke .15s; }
.zona.hover > *, .zona:focus-visible > * { fill: #bcd3f2; stroke: var(--primario); }
.zona.vacia { opacity: .45; }
.zona.activa { opacity: 1; }
.zona.activa > * { fill: var(--primario); stroke: #0b3f86; }
.zona.activa.hover > * { fill: #2f7ae5; }
.zona.arteria > * { fill: none; stroke: #d06060; stroke-width: 3.5; stroke-linecap: round; }
.zona.arteria.hover > * { stroke: #b03030; stroke-width: 5; }
.zona.arteria.activa > * { fill: none; stroke: #c62f2f; stroke-width: 5; }

.deco { pointer-events: none; fill: #6c7f99; stroke: #6c7f99; stroke-width: 1.5; }
.deco path { fill: none; }

.estado { margin: 0; font-weight: 600; font-size: .95rem; min-height: 1.4em; text-align: center; }
.estado.hover { color: var(--primario); }

.grupo { width: 100%; display: grid; gap: 5px; }
.titulo { font-size: .75rem; font-weight: 600; color: var(--texto-suave); }
.botones { display: flex; flex-wrap: wrap; gap: 5px; }
.botones button {
  border: 1.5px solid var(--borde); background: var(--superficie); color: var(--texto);
  padding: 3px 10px; border-radius: 999px; font-size: .78rem; cursor: pointer;
}
.botones button small { opacity: .65; margin-left: 2px; }
.botones button.cero:not(.on) { opacity: .45; }
.botones button.on { background: var(--primario); border-color: var(--primario); color: #fff; }

.ayuda { margin: 0; font-size: .72rem; color: var(--texto-suave); text-align: center; }
</style>
