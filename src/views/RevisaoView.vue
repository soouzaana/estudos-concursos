<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ArrowLeft, Eye, PartyPopper } from 'lucide-vue-next'
import type { Cartao, NotaRevisao } from '@/types'
import { useDadosStore } from '@/stores/dados'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { montarFila } from '@/services/fila'
import { previaIntervalos } from '@/services/fsrs'
import ProgressBar from '@/components/ProgressBar.vue'

const route = useRoute()
const dados = useDadosStore()
const config = useConfiguracoesStore()

const fila = ref<string[]>([])
const total = ref(0)
const feitos = ref(0)
const revelado = ref(false)
const ocupado = ref(false)
const contagemNotas = ref<Record<NotaRevisao, number>>({ errei: 0, dificil: 0, bom: 0, facil: 0 })

const q = (k: string) => (route.query[k] ? String(route.query[k]) : undefined)
const atual = computed<Cartao | undefined>(() => (fila.value[0] ? dados.cartoes.find((c) => c.id === fila.value[0]) : undefined))
const previa = computed(() => (atual.value ? previaIntervalos(atual.value, Date.now(), config.config.retencaoDesejada) : null))
const escopo = computed(() => [q('concurso') && dados.nomeConcurso(q('concurso')), q('disciplina') && dados.nomeDisciplina(q('disciplina')), q('topico') && dados.nomeTopico(q('topico')), q('caderno') && 'Caderno de erros'].filter(Boolean).join(' · ') || 'Todos os cartões')

onMounted(() => {
  const ids = montarFila(dados.cartoes, dados.revisoesCartao, {
    concursoId: q('concurso'), disciplinaId: q('disciplina'), topicoId: q('topico'), doCaderno: !!q('caderno'),
    modo: q('modo') === 'vencidas' ? 'vencidas' : 'hoje', novosPorDia: config.config.novosCartoesPorDia
  }).map((c) => c.id)
  fila.value = ids
  total.value = ids.length
  window.addEventListener('keydown', teclas)
})
onBeforeUnmount(() => window.removeEventListener('keydown', teclas))

function teclas(e: KeyboardEvent) {
  const alvo = e.target as HTMLElement | null
  if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return
  if (!atual.value) return
  if (!revelado.value && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault()
    revelado.value = true
  } else if (revelado.value) {
    const mapa: Record<string, NotaRevisao> = { '1': 'errei', '2': 'dificil', '3': 'bom', '4': 'facil' }
    if (mapa[e.key]) avaliar(mapa[e.key])
  }
}

async function avaliar(nota: NotaRevisao) {
  if (!atual.value || ocupado.value) return
  ocupado.value = true
  try {
    const id = atual.value.id
    const novo = await dados.revisar(id, nota)
    contagemNotas.value[nota]++
    fila.value = fila.value.slice(1)
    // Cartões que voltam em poucos minutos (reaprendizado) retornam ao fim da fila da sessão.
    if (novo && novo.proximaRevisao <= Date.now() + 20 * 60_000) fila.value = [...fila.value, id]
    else feitos.value++
    revelado.value = false
  } catch {
    /* já notificado */
  } finally {
    ocupado.value = false
  }
}

const botoes: { nota: NotaRevisao; rotulo: string; classe: string; tecla: string }[] = [
  { nota: 'errei', rotulo: 'Errei', classe: 'bg-rose-600 text-white hover:bg-rose-700', tecla: '1' },
  { nota: 'dificil', rotulo: 'Difícil', classe: 'bg-amber-500 text-white hover:bg-amber-600', tecla: '2' },
  { nota: 'bom', rotulo: 'Bom', classe: 'bg-emerald-600 text-white hover:bg-emerald-700', tecla: '3' },
  { nota: 'facil', rotulo: 'Fácil', classe: 'bg-sky-600 text-white hover:bg-sky-700', tecla: '4' }
]
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4">
    <RouterLink to="/flashcards" class="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft class="h-4 w-4" />Flashcards</RouterLink>
    <div>
      <p class="text-xs text-muted">{{ escopo }}</p>
      <div class="mt-1 flex items-center gap-3"><ProgressBar :valor="total ? (feitos / total) * 100 : 0" rotulo="Progresso da revisão" /><span class="shrink-0 text-xs tabular-nums text-muted">{{ feitos }}/{{ total }}</span></div>
    </div>

    <section v-if="atual" class="card flex min-h-[320px] flex-col" aria-live="polite">
      <div class="flex-1 p-5 sm:p-8">
        <div class="mb-3 flex flex-wrap gap-1.5">
          <span v-if="atual.disciplinaId" class="chip chip-muted">{{ dados.nomeDisciplina(atual.disciplinaId) }}</span>
          <span v-if="atual.topicoId" class="chip chip-muted">{{ dados.nomeTopico(atual.topicoId) }}</span>
        </div>
        <p class="whitespace-pre-line text-lg leading-relaxed sm:text-xl">{{ atual.frente }}</p>
        <template v-if="revelado">
          <hr class="my-5 border-line" />
          <p class="whitespace-pre-line text-base leading-relaxed text-muted sm:text-lg">{{ atual.verso }}</p>
        </template>
      </div>
      <div class="safe-bottom border-t border-line p-3">
        <button v-if="!revelado" type="button" class="btn btn-primary w-full" autofocus @click="revelado = true"><Eye class="h-4 w-4" />Mostrar resposta <span class="hidden text-xs opacity-70 sm:inline">(espaço)</span></button>
        <div v-else class="grid grid-cols-4 gap-2">
          <button v-for="b in botoes" :key="b.nota" type="button" class="flex min-h-[56px] flex-col items-center justify-center rounded-xl px-1 text-sm font-semibold transition active:scale-95 disabled:opacity-60" :class="b.classe" :disabled="ocupado" :aria-label="`${b.rotulo}, próxima revisão em ${previa?.[b.nota]}`" @click="avaliar(b.nota)">
            {{ b.rotulo }}<span class="text-[11px] font-normal opacity-90">{{ previa?.[b.nota] }}</span>
          </button>
        </div>
      </div>
    </section>

    <section v-else class="card card-pad space-y-3 text-center">
      <PartyPopper class="mx-auto h-10 w-10 text-accent" />
      <h2 class="text-lg font-semibold">{{ total ? 'Revisão concluída' : 'Nenhum cartão para revisar agora' }}</h2>
      <p class="text-sm text-muted">
        <template v-if="total">Você revisou {{ total }} cartão(ões): {{ contagemNotas.facil }} fácil, {{ contagemNotas.bom }} bom, {{ contagemNotas.dificil }} difícil, {{ contagemNotas.errei }} para rever.</template>
        <template v-else>Quando houver cartões vencidos ou novos dentro do limite diário, eles aparecem aqui.</template>
      </p>
      <RouterLink to="/flashcards" class="btn btn-primary">Voltar aos flashcards</RouterLink>
    </section>
  </div>
</template>
