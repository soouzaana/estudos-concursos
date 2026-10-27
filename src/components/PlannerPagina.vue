<script setup lang="ts">
/**
 * Uma página do planner exportado. Usa estilos inline (não depende de classes do Tailwind nem do tema
 * do app), para que a captura em imagem seja idêntica ao que se vê aqui.
 */
import { computed } from 'vue'
import type { StatusAtividade } from '@/types'
import type { PaginaPlanner } from '@/services/exportacao'
import { formatarMinutos } from '@/services/exportacao'

const props = defineProps<{
  pagina: PaginaPlanner
  tokens: Record<string, string>
  largura: number
  /** Altura fixa (PDF/A4). Sem valor, a altura acompanha o conteúdo (PNG). */
  altura?: number
  geradoEm: string
}>()

const rgb = (k: string) => `rgb(${props.tokens[k].split(' ').join(',')})`
const escuro = computed(() => props.tokens['--surface'].split(' ').map(Number).reduce((a, b) => a + b, 0) < 300)

const cores = computed(() => ({
  fundo: rgb('--surface'),
  card: rgb('--card'),
  texto: rgb('--ink'),
  suave: rgb('--muted'),
  linha: rgb('--line'),
  marca: rgb('--b600'),
  marcaSuave: rgb('--accent-soft'),
  marcaTexto: rgb('--accent-text')
}))

const STATUS_CORES = computed<Record<StatusAtividade, { bg: string; fg: string; marca: string }>>(() =>
  escuro.value
    ? {
        pendente: { bg: '#3f3f46', fg: '#f4f4f5', marca: '○' },
        em_andamento: { bg: '#78350f', fg: '#fef3c7', marca: '▸' },
        concluida: { bg: '#064e3b', fg: '#d1fae5', marca: '●' },
        pulada: { bg: '#881337', fg: '#ffe4e6', marca: '↷' }
      }
    : {
        pendente: { bg: '#e4e4e7', fg: '#27272a', marca: '○' },
        em_andamento: { bg: '#fef3c7', fg: '#78350f', marca: '▸' },
        concluida: { bg: '#d1fae5', fg: '#065f46', marca: '●' },
        pulada: { bg: '#ffe4e6', fg: '#9f1239', marca: '↷' }
      }
)
const LEGENDA: { s: StatusAtividade; r: string }[] = [
  { s: 'pendente', r: 'Pendente' },
  { s: 'em_andamento', r: 'Em andamento' },
  { s: 'concluida', r: 'Concluída' },
  { s: 'pulada', r: 'Pulada' }
]
const temReagendada = computed(() => props.pagina.blocos.some((b) => b.linhas.some((l) => l.reagendada)))
</script>

<template>
  <section
    class="planner-pagina"
    :style="{
      width: largura + 'px',
      height: altura ? altura + 'px' : 'auto',
      minHeight: altura ? undefined : '480px',
      background: cores.fundo,
      color: cores.texto,
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif',
      boxSizing: 'border-box',
      padding: '36px 40px 28px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      overflow: 'hidden',
      lineHeight: 1.35
    }"
  >
    <header :style="{ background: cores.marca, color: '#fff', borderRadius: '18px', padding: '20px 24px' }">
      <div :style="{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.9, fontWeight: 600 }">{{ pagina.titulo }}</div>
      <div :style="{ fontSize: '26px', fontWeight: 700, marginTop: '4px' }">{{ pagina.subtitulo }}</div>
      <div :style="{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '14px', marginTop: '6px', opacity: 0.95 }">
        <span>{{ pagina.periodo }}</span>
        <span v-if="pagina.total > 1">Página {{ pagina.numero }} de {{ pagina.total }}</span>
      </div>
    </header>

    <div v-if="pagina.metas" data-planner="metas" :style="{ display: 'flex', flexWrap: 'wrap', gap: '10px' }">
      <div v-for="item in [
        { r: 'Atividades', v: String(pagina.metas.atividades) },
        { r: 'Tempo previsto', v: formatarMinutos(pagina.metas.minutosPrevistos) },
        { r: 'Questões previstas', v: String(pagina.metas.questoesPrevistas) },
        { r: 'Meta diária', v: formatarMinutos(pagina.metas.metaDiariaMin) },
        { r: pagina.metas.metaSemanalConcursoH !== undefined ? 'Meta semanal (concurso)' : 'Meta semanal', v: pagina.metas.metaSemanalConcursoH !== undefined ? formatarMinutos(pagina.metas.metaSemanalConcursoH * 60) : formatarMinutos(pagina.metas.metaSemanalMin) }
      ]" :key="item.r" :style="{ flex: '1 1 120px', background: cores.card, border: '1px solid ' + cores.linha, borderRadius: '12px', padding: '8px 12px' }">
        <div :style="{ fontSize: '11px', color: cores.suave }">{{ item.r }}</div>
        <div :style="{ fontSize: '17px', fontWeight: 700, color: cores.marcaTexto }">{{ item.v }}</div>
      </div>
    </div>

    <div v-if="pagina.vazia" :style="{ background: cores.card, border: '1px dashed ' + cores.linha, borderRadius: '14px', padding: '28px', textAlign: 'center', color: cores.suave, fontSize: '14px' }">
      Nenhuma atividade planejada neste período.
    </div>

    <div :style="{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 auto' }">
      <article
        v-for="b in pagina.blocos"
        :key="b.data + (b.continuacao ? '-c' : '')"
        data-planner="dia"
        :style="{ display: 'flex', background: cores.card, border: '1px solid ' + cores.linha, borderRadius: '14px', overflow: 'hidden' }"
      >
        <div :style="{ width: '92px', flex: '0 0 92px', background: cores.marcaSuave, color: cores.marcaTexto, padding: '10px 8px', textAlign: 'center' }">
          <div :style="{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }">{{ b.diaCurto }}</div>
          <div :style="{ fontSize: '20px', fontWeight: 800 }">{{ b.dataCurta }}</div>
          <div v-if="b.continuacao" :style="{ fontSize: '10px', marginTop: '2px' }">(continuação)</div>
        </div>
        <ul :style="{ listStyle: 'none', margin: 0, padding: '6px 12px', flex: '1 1 auto', minWidth: 0 }">
          <li v-if="!b.linhas.length" :style="{ padding: '8px 0', fontSize: '13px', color: cores.suave }">Dia livre</li>
          <li
            v-for="l in b.linhas"
            :key="l.id"
            data-planner="linha"
            :style="{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderTop: '1px solid ' + cores.linha, fontSize: '13px' }"
          >
            <span v-if="pagina.incluirHorarios" :style="{ width: '46px', flex: '0 0 46px', color: cores.suave, fontVariantNumeric: 'tabular-nums' }">{{ l.horario ?? '—' }}</span>
            <span :style="{ width: '10px', height: '10px', flex: '0 0 10px', borderRadius: '50%', background: l.cor }" />
            <span :style="{ flex: '1 1 auto', minWidth: 0 }">
              <strong>{{ l.disciplina }}</strong>
              <span v-if="l.topico" :style="{ color: cores.suave }"> — {{ l.topico }}</span>
              <span v-if="pagina.mostrarConcurso && l.concurso" :style="{ display: 'block', fontSize: '11px', color: cores.suave }">{{ l.concurso }}</span>
            </span>
            <span :style="{ flex: '0 0 auto', color: cores.suave, whiteSpace: 'nowrap' }">{{ l.duracao }}<template v-if="l.questoes"> · {{ l.questoes }} q.</template></span>
            <span v-if="l.reagendada" title="Reagendada" :style="{ flex: '0 0 auto', color: cores.suave }">⟳</span>
            <span
              v-if="pagina.incluirStatus"
              :style="{ flex: '0 0 auto', background: STATUS_CORES[l.status].bg, color: STATUS_CORES[l.status].fg, borderRadius: '999px', padding: '2px 9px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }"
            >{{ STATUS_CORES[l.status].marca }} {{ l.statusRotulo }}</span>
          </li>
        </ul>
      </article>
    </div>

    <footer :style="{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px', fontSize: '11px', color: cores.suave, borderTop: '1px solid ' + cores.linha, paddingTop: '10px' }">
      <span v-if="pagina.incluirStatus" data-planner="legenda" :style="{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }">
        <strong>Legenda:</strong>
        <span v-for="x in LEGENDA" :key="x.s" :style="{ background: STATUS_CORES[x.s].bg, color: STATUS_CORES[x.s].fg, borderRadius: '999px', padding: '1px 8px', fontWeight: 600 }">{{ STATUS_CORES[x.s].marca }} {{ x.r }}</span>
        <span v-if="temReagendada">⟳ Reagendada</span>
      </span>
      <span v-else />
      <span>Gerado em {{ geradoEm }} · Estudos para Concursos</span>
    </footer>
  </section>
</template>
