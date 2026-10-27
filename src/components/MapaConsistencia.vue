<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useDadosStore } from '@/stores/dados'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { classificarDia, construirContextoDias, type StatusDia } from '@/services/stats'
import { fimMes, fimSemana, formatarDataExtenso, formatarMesAno, hoje, inicioMes, inicioSemana, intervaloDias, nomesDiasCurtos, somarMeses } from '@/utils/datas'

const props = defineProps<{ concursoId?: string; selecionado?: string; interativo?: boolean }>()
const emit = defineEmits<{ (e: 'selecionar', data: string): void }>()
const dados = useDadosStore()
const config = useConfiguracoesStore()

const mes = ref(inicioMes(hoje()))
const ctx = computed(() => construirContextoDias(dados.dadosStats, { concursoId: props.concursoId }, config.config, hoje()))
const dias = computed(() => intervaloDias(inicioSemana(mes.value), fimSemana(fimMes(mes.value))))
const nomes = nomesDiasCurtos()

const ROTULOS: Record<StatusDia, string> = { concluido: 'Concluído', parcial: 'Parcial', pulado: 'Pulado', sem_registro: 'Sem registro', futuro: 'Futuro' }
const CLASSES: Record<StatusDia, string> = {
  concluido: 'bg-emerald-500 text-white',
  parcial: 'bg-amber-300 text-amber-950',
  pulado: 'bg-rose-200 text-rose-900 dark:bg-rose-900/60 dark:text-rose-100',
  sem_registro: 'bg-line/70 text-muted',
  futuro: 'border border-dashed border-line text-muted/60'
}
const status = (d: string) => classificarDia(d, ctx.value)
</script>

<template>
  <section class="card card-pad" aria-labelledby="t-mapa">
    <div class="mb-3 flex items-center justify-between">
      <h2 id="t-mapa" class="section-title">Mapa de consistência</h2>
      <div class="flex items-center gap-1">
        <button type="button" class="btn-icon h-9 w-9" aria-label="Mês anterior" @click="mes = somarMeses(mes, -1)"><ChevronLeft class="h-4 w-4" /></button>
        <span class="min-w-[110px] text-center text-sm font-medium capitalize">{{ formatarMesAno(mes) }}</span>
        <button type="button" class="btn-icon h-9 w-9" aria-label="Próximo mês" @click="mes = somarMeses(mes, 1)"><ChevronRight class="h-4 w-4" /></button>
      </div>
    </div>
    <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted"><span v-for="n in nomes" :key="n">{{ n }}</span></div>
    <div class="mt-1 grid grid-cols-7 gap-1">
      <component
        :is="interativo ? 'button' : 'div'" v-for="d in dias" :key="d" :type="interativo ? 'button' : undefined"
        class="flex aspect-square max-h-12 items-center justify-center rounded-lg text-xs font-medium"
        :class="[CLASSES[status(d)], d < inicioMes(mes) || d > fimMes(mes) ? 'opacity-30' : '', d === hoje() ? 'ring-2 ring-brand-600 ring-offset-1 ring-offset-card' : '', selecionado === d ? 'outline outline-2 outline-ink' : '']"
        :aria-label="`${formatarDataExtenso(d)}: ${ROTULOS[status(d)]}`" @click="interativo && emit('selecionar', d)"
      >{{ Number(d.slice(8)) }}</component>
    </div>
    <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legenda">
      <li v-for="(r, k) in ROTULOS" :key="k" class="flex items-center gap-1.5"><span class="h-3 w-3 rounded" :class="CLASSES[k as StatusDia]" />{{ r }}</li>
    </ul>
    <p class="mt-2 text-xs text-muted">Dia sem registro não é considerado pulado: só conta como pulado se você marcar ou pular a atividade prevista.</p>
  </section>
</template>
