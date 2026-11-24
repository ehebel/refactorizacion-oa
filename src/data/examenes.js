// Catálogo de ejemplo de exámenes de imagenología (se reemplaza al cargar el zip OCL).
// Igual que el catálogo cargado, modalidad, región y lateralidad se guardan como LOINC Parts (LP).
import { LP, REGION_A_PARTE, construirVocabulario } from './loinc.js'
import { traducir } from './es/index.js'

// Modalidad del ejemplo → LOINC Part
const MOD_LP = {
  RX: ['LP212285-3', 'XR'],
  TC: ['LP200067-9', 'CT'],
  RM: ['LP206549-0', 'MR'],
  FL: ['LP220472-7', 'Radio fluoroscopy'],
  ECO: ['LP207608-3', 'US'],
  MN: ['LP208891-4', 'NM'],
  MG: ['LP208647-0', 'Mammogram'],
  DXA: ['LP208571-2', 'Dual Energy X-ray Absorptiometry (DXA)']
}
// Región / lateralidad del ejemplo → LOINC Part
const REGION_LP = {
  Abdomen: LP.ABDOMEN,
  Breast: LP.BREAST,
  'Cerebral artery middle': LP.CEREBRAL_ARTERY_MIDDLE,
  Chest: LP.CHEST,
  Extremity: LP.EXTREMITY,
  Head: LP.HEAD,
  'Lower extremity': LP.LOWER_EXTREMITY,
  Neck: LP.NECK,
  Pelvis: LP.PELVIS,
  'Unspecified region imaged': LP.UNSPECIFIED_REGION,
  'Upper extremity': LP.UPPER_EXTREMITY,
  'Whole Body': LP.WHOLE_BODY,
  'Umbilical artery': LP.UMBILICAL_ARTERY,
  'Umbilical cord': LP.UMBILICAL_CORD,
  'Umbilical vessels': LP.UMBILICAL_VESSELS
}
const LAT_LP = {
  Bilateral: LP.BILATERAL,
  Left: LP.LEFT,
  Right: LP.RIGHT,
  Unilateral: LP.UNILATERAL,
  Unspecified: LP.UNSPECIFIED_LAT
}

const LAT_TEXTO = { Left: 'izquierda', Right: 'derecha', Bilateral: 'bilateral', Unilateral: 'unilateral' }

// [modalidad, región, nombre, lateralidades]
const U = ['Unspecified']
const LRB = ['Left', 'Right', 'Bilateral']
const LR = ['Left', 'Right']
const UB = ['Unilateral', 'Bilateral']

const RAW = [
  // Head
  ['RX', 'Head', 'Radiografía de cráneo', U],
  ['RX', 'Head', 'Radiografía de senos paranasales', U],
  ['TC', 'Head', 'TC de cerebro sin contraste', U],
  ['TC', 'Head', 'TC de cerebro con contraste', U],
  ['TC', 'Head', 'TC de senos paranasales', U],
  ['TC', 'Head', 'TC de órbitas', U],
  ['TC', 'Head', 'TC de peñascos', LRB],
  ['TC', 'Head', 'TC de macizo facial', U],
  ['RM', 'Head', 'RM de cerebro sin contraste', U],
  ['RM', 'Head', 'RM de cerebro con gadolinio', U],
  ['RM', 'Head', 'RM de hipófisis', U],
  ['RM', 'Head', 'RM de órbitas', U],
  ['RM', 'Head', 'RM de conductos auditivos internos', LRB],
  ['ECO', 'Head', 'Ecografía transfontanelar', U],
  ['ECO', 'Head', 'Ecografía ocular', LRB],
  ['MN', 'Head', 'SPECT cerebral de perfusión', U],
  // Cerebral artery middle
  ['ECO', 'Cerebral artery middle', 'Doppler transcraneal de arteria cerebral media', LRB],
  ['ECO', 'Cerebral artery middle', 'Doppler fetal de arteria cerebral media', U],
  ['TC', 'Cerebral artery middle', 'Angio-TC de arteria cerebral media', LRB],
  ['RM', 'Cerebral artery middle', 'Angio-RM de arteria cerebral media', LRB],
  // Neck
  ['ECO', 'Neck', 'Ecografía tiroidea', U],
  ['ECO', 'Neck', 'Ecografía de partes blandas de cuello', U],
  ['ECO', 'Neck', 'Ecografía Doppler carotídeo', LRB],
  ['ECO', 'Neck', 'Ecografía de glándula parótida', LRB],
  ['RX', 'Neck', 'Radiografía de partes blandas de cuello', U],
  ['TC', 'Neck', 'TC de cuello con contraste', U],
  ['TC', 'Neck', 'Angio-TC de vasos del cuello', U],
  ['RM', 'Neck', 'RM de cuello', U],
  ['MN', 'Neck', 'Cintigrafía tiroidea', U],
  ['MN', 'Neck', 'Cintigrafía de paratiroides', U],
  ['FL', 'Neck', 'Videodeglución', U],
  // Chest
  ['RX', 'Chest', 'Radiografía de tórax PA y lateral', U],
  ['RX', 'Chest', 'Radiografía de tórax AP portátil', U],
  ['RX', 'Chest', 'Radiografía de parrilla costal', LRB],
  ['TC', 'Chest', 'TC de tórax sin contraste', U],
  ['TC', 'Chest', 'TC de tórax con contraste', U],
  ['TC', 'Chest', 'TC de tórax de alta resolución', U],
  ['TC', 'Chest', 'Angio-TC de arterias pulmonares', U],
  ['TC', 'Chest', 'Angio-TC coronaria', U],
  ['RM', 'Chest', 'RM cardíaca', U],
  ['ECO', 'Chest', 'Ecografía pleural', LRB],
  ['MN', 'Chest', 'Cintigrafía pulmonar V/Q', U],
  ['MN', 'Chest', 'Cintigrafía de perfusión miocárdica', U],
  ['FL', 'Chest', 'Esofagograma con bario', U],
  // Breast
  ['MG', 'Breast', 'Mamografía de screening', ['Bilateral']],
  ['MG', 'Breast', 'Mamografía diagnóstica', LRB],
  ['MG', 'Breast', 'Proyecciones mamográficas complementarias', LR],
  ['MG', 'Breast', 'Tomosíntesis mamaria', LRB],
  ['MG', 'Breast', 'Biopsia mamaria estereotáxica', LR],
  ['ECO', 'Breast', 'Ecografía mamaria', LRB],
  ['ECO', 'Breast', 'Biopsia mamaria guiada por ecografía', LR],
  ['RM', 'Breast', 'RM de mamas con gadolinio', UB],
  // Abdomen
  ['RX', 'Abdomen', 'Radiografía de abdomen simple', U],
  ['ECO', 'Abdomen', 'Ecografía abdominal', U],
  ['ECO', 'Abdomen', 'Ecografía Doppler hepático', U],
  ['ECO', 'Abdomen', 'Ecografía renal', LRB],
  ['TC', 'Abdomen', 'TC de abdomen y pelvis con contraste', U],
  ['TC', 'Abdomen', 'TC trifásica de hígado', U],
  ['TC', 'Abdomen', 'Uro-TC', U],
  ['TC', 'Abdomen', 'Angio-TC de aorta abdominal', U],
  ['RM', 'Abdomen', 'RM de abdomen', U],
  ['RM', 'Abdomen', 'Colangio-RM', U],
  ['FL', 'Abdomen', 'Estudio esófago-estómago-duodeno', U],
  ['MN', 'Abdomen', 'Cintigrafía renal DMSA', U],
  // Umbilical (dentro de Abdomen)
  ['ECO', 'Umbilical artery', 'Doppler de arteria umbilical', U],
  ['ECO', 'Umbilical cord', 'Ecografía de cordón umbilical', U],
  ['ECO', 'Umbilical vessels', 'Doppler de vasos umbilicales', U],
  ['RX', 'Umbilical vessels', 'Radiografía para posición de catéter umbilical', U],
  // Pelvis
  ['RX', 'Pelvis', 'Radiografía de pelvis AP', U],
  ['ECO', 'Pelvis', 'Ecografía pelviana transabdominal', U],
  ['ECO', 'Pelvis', 'Ecografía ginecológica transvaginal', U],
  ['ECO', 'Pelvis', 'Ecografía obstétrica', U],
  ['ECO', 'Pelvis', 'Ecografía testicular', LRB],
  ['ECO', 'Pelvis', 'Ecografía de ovario', LR],
  ['TC', 'Pelvis', 'TC de pelvis', U],
  ['RM', 'Pelvis', 'RM de pelvis', U],
  ['RM', 'Pelvis', 'RM de próstata multiparamétrica', U],
  ['FL', 'Pelvis', 'Histerosalpingografía', U],
  // Extremity (genérico)
  ['RX', 'Extremity', 'Radiografía de extremidad', UB],
  ['ECO', 'Extremity', 'Ecografía de partes blandas de extremidad', UB],
  ['ECO', 'Extremity', 'Doppler venoso de extremidad', UB],
  ['RM', 'Extremity', 'RM de extremidad', ['Unilateral']],
  // Upper extremity
  ['RX', 'Upper extremity', 'Radiografía de hombro', LRB],
  ['RX', 'Upper extremity', 'Radiografía de húmero', LR],
  ['RX', 'Upper extremity', 'Radiografía de codo', LR],
  ['RX', 'Upper extremity', 'Radiografía de antebrazo', LR],
  ['RX', 'Upper extremity', 'Radiografía de muñeca', LRB],
  ['RX', 'Upper extremity', 'Radiografía de mano', LRB],
  ['ECO', 'Upper extremity', 'Ecografía de hombro', LRB],
  ['ECO', 'Upper extremity', 'Ecografía de túnel carpiano', LRB],
  ['ECO', 'Upper extremity', 'Doppler venoso de extremidad superior', LRB],
  ['TC', 'Upper extremity', 'TC de muñeca', LR],
  ['RM', 'Upper extremity', 'RM de hombro', LR],
  ['RM', 'Upper extremity', 'RM de codo', LR],
  ['RM', 'Upper extremity', 'RM de muñeca', LR],
  // Lower extremity
  ['RX', 'Lower extremity', 'Radiografía de cadera', LRB],
  ['RX', 'Lower extremity', 'Radiografía de fémur', LR],
  ['RX', 'Lower extremity', 'Radiografía de rodilla', LRB],
  ['RX', 'Lower extremity', 'Radiografía de pierna', LR],
  ['RX', 'Lower extremity', 'Radiografía de tobillo', LRB],
  ['RX', 'Lower extremity', 'Radiografía de pie', LRB],
  ['ECO', 'Lower extremity', 'Ecografía de rodilla', LR],
  ['ECO', 'Lower extremity', 'Ecografía de caderas del lactante', ['Bilateral']],
  ['ECO', 'Lower extremity', 'Doppler venoso de extremidad inferior', LRB],
  ['ECO', 'Lower extremity', 'Doppler arterial de extremidad inferior', LRB],
  ['TC', 'Lower extremity', 'TC de rodilla', LR],
  ['TC', 'Lower extremity', 'Angio-TC de extremidades inferiores', ['Bilateral']],
  ['RM', 'Lower extremity', 'RM de cadera', LR],
  ['RM', 'Lower extremity', 'RM de rodilla', LR],
  ['RM', 'Lower extremity', 'RM de tobillo', LR],
  ['DXA', 'Lower extremity', 'Densitometría de cadera', LRB],
  // Whole Body
  ['RX', 'Whole Body', 'Serie ósea completa', U],
  ['TC', 'Whole Body', 'TC de cuerpo entero (trauma)', U],
  ['RM', 'Whole Body', 'RM de cuerpo entero', U],
  ['MN', 'Whole Body', 'Cintigrafía ósea de cuerpo entero', U],
  ['MN', 'Whole Body', 'PET-CT de cuerpo entero', U],
  ['DXA', 'Whole Body', 'Densitometría de cuerpo entero', U],
  // Unspecified region imaged
  ['RX', 'Unspecified region imaged', 'Radiografía de región no especificada', U],
  ['ECO', 'Unspecified region imaged', 'Ecografía de partes blandas', U],
  ['ECO', 'Unspecified region imaged', 'Punción guiada por ecografía', U],
  ['TC', 'Unspecified region imaged', 'Biopsia guiada por TC', U],
  ['FL', 'Unspecified region imaged', 'Fluoroscopía para guía de procedimiento', U]
]

const encontrados = { modalidad: new Map(), region: new Map(), lateralidad: new Map() }
const contador = {}
export const EXAMENES = RAW.flatMap(([modalidad, region, nombre, lats]) =>
  lats.map((lateralidad) => {
    contador[modalidad] = (contador[modalidad] || 0) + 1
    const codigo = `${modalidad}-${String(contador[modalidad]).padStart(3, '0')}`
    const [modLP, modNombre] = MOD_LP[modalidad]
    encontrados.modalidad.set(modLP, modNombre)
    encontrados.region.set(REGION_LP[region], region)
    encontrados.lateralidad.set(LAT_LP[lateralidad], lateralidad)
    return {
      id: codigo,
      codigo,
      loinc: null,
      nombre: lateralidad === 'Unspecified' ? nombre : `${nombre} (${LAT_TEXTO[lateralidad]})`,
      nombreEn: '',
      modalidades: [modLP],
      regiones: [REGION_LP[region]],
      partes: [REGION_A_PARTE[REGION_LP[region]] ?? REGION_LP[region]],
      lateralidades: [LAT_LP[lateralidad]],
      buscable: `${modNombre} ${modalidad} ${region} ${traducir('region', region)}`
    }
  })
)

export const VOCABULARIO = construirVocabulario(encontrados)
