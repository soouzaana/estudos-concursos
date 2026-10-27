<script setup lang="ts">
import { computed, ref } from 'vue'
import { CalendarClock, Check, ChevronsRight, ListChecks, Pencil, Play, RotateCcw } from 'lucide-vue-next'
import type { Atividade } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { dataEfetiva, estaAberta, estaAtrasada, tempoRealizadoSeg } from '@/services/cronograma'
import { formatarData, formatarDuracao, hoje } from '@/utils/datas'
import { useToast } from '@/composables/useToast'
import BaseModal from './BaseModal.vue'

const props = defineProps<{ atividade: Atividade; mostrarConcurso?: boolean; compacto?: boolean }>()
const emit = defineEmits<{
  (e: 'iniciar', a: Atividade): void
  (e: 'concluir', a: Atividade): void
  (e: 'pular', a: Atividade): void
  (e: 'reabrir', a: Atividade): void
  (e: 'editar', a: Atividade): void
  (e: 'questoes', a: Atividade): void
}>()
const dados = useDadosStore()
const toast = useToast()
const reagendando = ref(false)
const novaData = ref(hoje())

function abrirReagendar() {
  novaData.value = dataEfetiva(props.atividade) < hoje() ? hoje() : dataEfetiva(props.atividade)
  reagendando.value = true
}
async function confirmarReagendar() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(novaData.value)) return
  await dados.reagendar(props.atividade.id, novaData.value).catch(() => undefined)
  toast.sucesso(`Reagendada para ${formatarData(novaData.value)}. A data planejada original foi preservada.`)
  reagendando.value = false
}

const aberta = computed(() => estaAberta(props.atividade))
const atrasada = computed(() => estaAtrasada(props.atividade, hoje()))
const realizado = computed(() => tempoRealizadoSeg(props.atividade.id, dados.sessoes))
const rotuloStatus: Record<Atividade['status'], string> = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída', pulada: 'Pulada' }
const classeStatus: Record<Atividade['status'], string> = { pendente: 'chip-muted', em_andamento: 'chip-info', concluida: 'chip-ok', pulada: 'chip-warn' }
</script>

<template>
  <div class="flex gap-3 rounded-2xl border border-line bg-card p-3" :class="atividade.status === 'pulada' ? 'opacity-80' : ''">
    <span class="mt-1 h-10 w-1.5 shrink-0 rounded-full" :style="{ background: dados.corDisciplina(atividade.disciplinaId) }" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p class="truncate text-sm font-semibold" :class="atividade.status === 'pulada' ? 'line-through decoration-1' : ''">{{ dados.nomeDisciplina(atividade.disciplinaId) }}</p>
        <span class="chip" :class="classeStatus[atividade.status]">{{ rotuloStatus[atividade.status] }}</span>
        <span v-if="atrasada" class="chip chip-warn">Atrasada</span>
        <span v-if="atividade.prioridade === 'alta'" class="chip chip-bad">Prioridade alta</span>
      </div>
      <p v-if="atividade.topicoId" class="truncate text-xs text-muted">{{ dados.nomeTopico(atividade.topicoId) }}</p>
      <p v-if="mostrarConcurso" class="truncate text-xs text-muted">{{ dados.nomeConcurso(atividade.concursoId) }}</p>
      <p class="mt-1 text-xs text-muted">
        <template v-if="atividade.horario">{{ atividade.horario }} · </template>
        Previsto {{ formatarDuracao(atividade.duracaoMin * 60) }} · Realizado {{ formatarDuracao(realizado) }}
        <template v-if="atividade.questoesPrevistas"> · {{ atividade.questoesPrevistas }} questões</template>
      </p>
      <p v-if="!compacto && (atividade.reagendadaPara || atividade.dataRealizacao)" class="text-xs text-muted">
        Planejada {{ formatarData(atividade.dataPlanejada) }}
        <template v-if="atividade.reagendadaPara"> · reagendada para {{ formatarData(atividade.reagendadaPara) }}</template>
        <template v-if="atividade.dataRealizacao"> · feita em {{ formatarData(atividade.dataRealizacao) }}</template>
      </p>
      <p v-else-if="!compacto && dataEfetiva(atividade) !== hoje()" class="text-xs text-muted">{{ formatarData(dataEfetiva(atividade)) }}</p>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <template v-if="aberta">
          <button v-if="atividade.status === 'pendente'" type="button" class="btn btn-soft btn-sm" @click="emit('iniciar', atividade)"><Play class="h-3.5 w-3.5" />Iniciar</button>
          <button v-else type="button" class="btn btn-soft btn-sm" @click="emit('iniciar', atividade)"><Play class="h-3.5 w-3.5" />Continuar</button>
          <button type="button" class="btn btn-outline btn-sm" @click="emit('concluir', atividade)"><Check class="h-3.5 w-3.5" />Concluir</button>
          <button type="button" class="btn btn-outline btn-sm" @click="emit('pular', atividade)"><ChevronsRight class="h-3.5 w-3.5" />Pular</button>
          <button type="button" class="btn btn-outline btn-sm" @click="emit('questoes', atividade)"><ListChecks class="h-3.5 w-3.5" />Questões</button>
          <button type="button" class="btn btn-outline btn-sm" @click="abrirReagendar"><CalendarClock class="h-3.5 w-3.5" />Reagendar</button>
        </template>
        <button v-else type="button" class="btn btn-outline btn-sm" @click="emit('reabrir', atividade)"><RotateCcw class="h-3.5 w-3.5" />Reabrir</button>
        <button type="button" class="btn btn-ghost btn-sm" :aria-label="'Editar atividade de ' + dados.nomeDisciplina(atividade.disciplinaId)" @click="emit('editar', atividade)"><Pencil class="h-3.5 w-3.5" /></button>
      </div>
    </div>
  </div>
  <BaseModal v-model="reagendando" titulo="Reagendar atividade" largura="sm">
    <p class="mb-3 text-sm text-muted">{{ dados.nomeDisciplina(atividade.disciplinaId) }} — planejada para {{ formatarData(atividade.dataPlanejada) }}. A data original continua registrada.</p>
    <label class="label" :for="'rg-' + atividade.id">Nova data</label>
    <input :id="'rg-' + atividade.id" v-model="novaData" type="date" class="input" />
    <template #rodape>
      <button type="button" class="btn btn-outline" @click="reagendando = false">Cancelar</button>
      <button type="button" class="btn btn-primary" @click="confirmarReagendar">Reagendar</button>
    </template>
  </BaseModal>
</template>
