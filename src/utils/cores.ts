/** Cores de identificação das disciplinas (ciclo de 12 matizes, saturação moderada). */
const CORES = ['#7c3aed', '#db2777', '#2563eb', '#059669', '#d97706', '#0891b2', '#9333ea', '#dc2626', '#65a30d', '#0d9488', '#c2410c', '#4f46e5']

export const coresDisciplina = () => [...CORES]
/** Cor para o índice informado (cicla). */
export const corDaDisciplina = (indice: number) => CORES[indice % CORES.length]
