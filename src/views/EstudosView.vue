<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Clock, Pause, Pencil, Play, Plus, Square, Timer, Trash2, X } from 'lucide-vue-next'
import type { MetodoEstudo, Sessao } from '@/types'
import { METODOS } from '@/types'
import { useCronometroStore } from '@/stores/cronometro'
import { useDadosStore } from '@/stores/dados'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { estaAberta } from '@/services/cronograma'
import { formatarCronometro, formatarData, formatarDuracao, formatarHora, hoje } from '@/utils/datas'
import { confirmar } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import BaseModal from '@/components/BaseModal.vue'
import ConcursoSelect from '@/components/ConcursoSelect.vue'
import DisciplinaSelect from '@/components/DisciplinaSelect.vue'
import EmptyState from '@/components/EmptyState.vue'
import FormField from '@/components/FormField.vue'
import SessaoForm from '@/components/SessaoForm.vue'
import TopicoSelect from '@/components/TopicoSelect.vue'

const cron = useCronometroStore()
const dados = useDadosStore()
const config = useConfiguracoesStore()
const toast = useToast()
const route = useRoute()

/* ---- iniciar ---- */
const ini = reactive({
  concursoId: undefined as string | undefined, disciplinaId: undefined as string | undefined, topicoId: undefined as string | undefined,
  atividadeId: undefined as string | undefined, metodo: 'teoria' as MetodoEstudo, observacoes: ''
})
const atividadesAbertas = computed(() => dados.atividades.filter((a) => estaAberta(a) && (!ini.concursoId || a.concursoId === ini.concursoId)).slice(0, 60))
watch(() => ini.disciplinaId, (n, o) => {
  if (o !== undefined && n !== o) ini.topicoId = undefined
}, { flush: 'sync' })
watch(() => ini.atividadeId, (id) => {
  const a = id ? dados.atividadePorId(id) : undefined
  if (a) Object.assign(ini, { concursoId: a.concursoId, disciplinaId: a.disciplinaId, topicoId: a.topicoId })
})

async function iniciar() {
  const ok = await cron.iniciar({ ...ini, observacoes: ini.observacoes.trim() })
  if (!ok) toast.info('Já existe uma sessão em andamento.')
}

/* ---- sessão ativa ---- */
const detalhes = computed({
  get: () => ({
    concursoId: cron.estado?.concursoId, disciplinaId: cron.estado?.disciplinaId, topicoId: cron.estado?.topicoId,
    metodo: cron.estado?.metodo ?? 'teoria', observacoes: cron.estado?.observacoes ?? ''
  }),
  set: () => undefined
})
const finalizarAberto = ref(false)
const minutosFinal = ref(0)
const concluirAtiv = ref(false)
const atividadeAtiva = computed(() => (cron.estado?.atividadeId ? dados.atividadePorId(cron.estado.atividadeId) : undefined))

function abrirFinalizar() {
  minutosFinal.value = Math.round(cron.decorridoMs / 60000)
  concluirAtiv.value = false
  finalizarAberto.value = true
}
async function finalizar() {
  const seg = Math.round(Number(minutosFinal.value) * 60)
  if (!Number.isFinite(seg) || seg <= 0) {
    toast.erro('Informe uma duração maior que zero ou descarte a sessão.')
    return
  }
  const original = Math.round(cron.decorridoMs / 1000)
  const s = await cron.finalizar({ duracaoSeg: Math.abs(seg - original) < 60 ? undefined : seg, concluirAtividade: concluirAtiv.value }).catch(() => null)
  if (s) {
    toast.sucesso(`Sessão de ${formatarDuracao(s.duracaoSeg)} registrada.`)
    finalizarAberto.value = false
  } else {
    toast.erro('Nenhum tempo foi contabilizado. Edite a duração ou descarte a sessão.')
  }
}
async function descartar() {
  const ok = await confirmar({
    titulo: 'Descartar sessão em andamento?',
    mensagem: `O tempo de ${formatarDuracao(cron.decorridoMs / 1000)} não será registrado. Essa ação não pode ser desfeita.`,
    confirmar: 'Descartar',
    perigo: true
  })
  if (ok) {
    await cron.descartar().catch(() => undefined)
    toast.info('Sessão descartada.')
  }
}

/* ---- histórico ---- */
const filtro = reactive({ concursoId: undefined as string | undefined, disciplinaId: undefined as string | undefined, de: '', ate: '' })
const limite = ref(30)
const sessoesFiltradas = computed(() =>
  dados.sessoes
    .filter((s) => (!filtro.concursoId || s.concursoId === filtro.concursoId) && (!filtro.disciplinaId || s.disciplinaId === filtro.disciplinaId) && (!filtro.de || s.data >= filtro.de) && (!filtro.ate || s.data <= filtro.ate))
    .sort((a, b) => b.inicio - a.inicio)
)
const totalFiltrado = computed(() => sessoesFiltradas.value.reduce((t, s) => t + s.duracaoSeg, 0))
const rotuloMetodo = (m: MetodoEstudo) => METODOS.find((x) => x.valor === m)?.rotulo ?? m

const formAberto = ref(false)
const edicao = ref<Sessao | null>(null)
function novaManual() {
  edicao.value = null
  formAberto.value = true
}
function editar(s: Sessao) {
  edicao.value = s
  formAberto.value = true
}
async function excluir(s: Sessao) {
  const ok = await confirmar({ titulo: 'Excluir sessão?', mensagem: `A sessão de ${formatarDuracao(s.duracaoSeg)} em ${formatarData(s.data)} deixará de contar nas estatísticas.`, confirmar: 'Excluir', perigo: true })
  if (ok) await dados.excluirSessao(s.id).catch(() => undefined)
}

const metaDia = computed(() => config.metaHoje.metaDiariaMin)
const hojeSeg = computed(() => dados.sessoes.filter((s) => s.data === hoje()).reduce((t, s) => t + s.duracaoSeg, 0))
if (route.query.concurso) ini.concursoId = String(route.query.concurso)
</script>

<template>
  <div class="space-y-5">
    <h1 class="page-title hidden lg:block">Estudos</h1>

    <!-- Cronômetro ativo -->
    <section v-if="cron.ativo" class="card card-pad space-y-4" aria-label="Sessão em andamento">
      <div class="text-center">
        <p class="text-xs font-medium uppercase tracking-wide text-muted">{{ cron.rodando ? 'Estudando agora' : 'Pausado' }}</p>
        <p class="my-2 font-mono text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl" role="timer" :aria-label="`Tempo decorrido ${formatarCronometro(cron.decorridoMs)}`">{{ formatarCronometro(cron.decorridoMs) }}</p>
        <p class="text-sm text-muted">
          {{ cron.estado?.disciplinaId ? dados.nomeDisciplina(cron.estado.disciplinaId) : 'Estudo livre' }}<template v-if="cron.estado?.topicoId"> · {{ dados.nomeTopico(cron.estado.topicoId) }}</template><br />
          {{ dados.nomeConcurso(cron.estado?.concursoId) }}
        </p>
        <p v-if="atividadeAtiva" class="mt-1 text-xs text-muted">Atividade do cronograma: {{ dados.nomeDisciplina(atividadeAtiva.disciplinaId) }} ({{ atividadeAtiva.duracaoMin }} min previstos)</p>
      </div>
      <div class="flex flex-wrap justify-center gap-2">
        <button v-if="cron.rodando" type="button" class="btn btn-soft min-w-[130px]" @click="cron.pausar()"><Pause class="h-4 w-4" />Pausar</button>
        <button v-else type="button" class="btn btn-primary min-w-[130px]" @click="cron.continuar()"><Play class="h-4 w-4" />Continuar</button>
        <button type="button" class="btn btn-primary min-w-[130px]" @click="abrirFinalizar"><Square class="h-4 w-4" />Finalizar</button>
        <button type="button" class="btn btn-outline" @click="descartar"><X class="h-4 w-4" />Descartar</button>
      </div>
      <details class="rounded-2xl border border-line p-3">
        <summary class="cursor-pointer text-sm font-medium">Editar detalhes da sessão</summary>
        <div class="mt-3 space-y-3">
          <FormField rotulo="Concurso" para="ca-conc"><ConcursoSelect id="ca-conc" :model-value="detalhes.concursoId" @update:model-value="cron.atualizarDetalhes({ concursoId: $event })" /></FormField>
          <FormField rotulo="Disciplina" para="ca-disc"><DisciplinaSelect id="ca-disc" :model-value="detalhes.disciplinaId" :concurso-id="detalhes.concursoId" permite-vazio rotulo-vazio="Sem disciplina" @update:model-value="cron.atualizarDetalhes({ disciplinaId: $event, topicoId: undefined })" /></FormField>
          <FormField rotulo="Tópico" para="ca-top"><TopicoSelect id="ca-top" :model-value="detalhes.topicoId" :disciplina-id="detalhes.disciplinaId" @update:model-value="cron.atualizarDetalhes({ topicoId: $event })" /></FormField>
          <FormField rotulo="Método" para="ca-met"><select id="ca-met" class="input" :value="detalhes.metodo" @change="cron.atualizarDetalhes({ metodo: ($event.target as HTMLSelectElement).value as MetodoEstudo })"><option v-for="m in METODOS" :key="m.valor" :value="m.valor">{{ m.rotulo }}</option></select></FormField>
          <FormField rotulo="Observações" para="ca-obs"><textarea id="ca-obs" class="input" :value="detalhes.observacoes" maxlength="1000" @change="cron.atualizarDetalhes({ observacoes: ($event.target as HTMLTextAreaElement).value })" /></FormField>
        </div>
      </details>
      <p class="text-center text-xs text-muted">O tempo é calculado por horários gravados: continua correto se você fechar o app ou trocar de aba.</p>
    </section>

    <!-- Iniciar -->
    <section v-else class="card card-pad space-y-3" aria-labelledby="t-iniciar">
      <div class="flex items-center justify-between">
        <h2 id="t-iniciar" class="section-title">Iniciar sessão</h2>
        <span class="text-xs text-muted">Hoje: {{ formatarDuracao(hojeSeg) }} / {{ formatarDuracao(metaDia * 60) }}</span>
      </div>
      <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="iniciar">
        <FormField v-if="atividadesAbertas.length" rotulo="Atividade do cronograma (opcional)" para="in-ativ">
          <select id="in-ativ" v-model="ini.atividadeId" class="input">
            <option :value="undefined">Estudo livre</option>
            <option v-for="a in atividadesAbertas" :key="a.id" :value="a.id">{{ formatarData(a.dataPlanejada).slice(0, 5) }} · {{ dados.nomeDisciplina(a.disciplinaId) }} · {{ dados.nomeConcurso(a.concursoId) }}</option>
          </select>
        </FormField>
        <FormField rotulo="Concurso" para="in-conc"><ConcursoSelect id="in-conc" v-model="ini.concursoId" /></FormField>
        <FormField rotulo="Disciplina" para="in-disc"><DisciplinaSelect id="in-disc" v-model="ini.disciplinaId" :concurso-id="ini.concursoId" permite-vazio rotulo-vazio="Sem disciplina" /></FormField>
        <FormField rotulo="Tópico" para="in-top"><TopicoSelect id="in-top" v-model="ini.topicoId" :disciplina-id="ini.disciplinaId" /></FormField>
        <FormField rotulo="Método" para="in-met"><select id="in-met" v-model="ini.metodo" class="input"><option v-for="m in METODOS" :key="m.valor" :value="m.valor">{{ m.rotulo }}</option></select></FormField>
        <div class="sm:col-span-2"><FormField rotulo="Observações" para="in-obs"><input id="in-obs" v-model="ini.observacoes" class="input" maxlength="300" /></FormField></div>
        <div class="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" class="btn btn-primary"><Play class="h-4 w-4" />Iniciar cronômetro</button>
          <button type="button" class="btn btn-outline" @click="novaManual"><Plus class="h-4 w-4" />Registrar manualmente</button>
        </div>
      </form>
    </section>
    <div v-if="cron.ativo" class="flex justify-end"><button type="button" class="btn btn-outline" @click="novaManual"><Plus class="h-4 w-4" />Registrar sessão manualmente</button></div>

    <!-- Histórico -->
    <section class="space-y-3" aria-labelledby="t-hist">
      <div class="flex flex-wrap items-end justify-between gap-2">
        <h2 id="t-hist" class="section-title">Histórico de sessões</h2>
        <p class="text-xs text-muted">{{ sessoesFiltradas.length }} sessões · {{ formatarDuracao(totalFiltrado) }}</p>
      </div>
      <div class="grid gap-2 sm:grid-cols-4">
        <ConcursoSelect v-model="filtro.concursoId" incluir-todos :so-abertos="false" aria-label="Filtrar por concurso" />
        <select v-model="filtro.disciplinaId" class="input" aria-label="Filtrar por disciplina"><option :value="undefined">Todas as disciplinas</option><option v-for="d in dados.disciplinas" :key="d.id" :value="d.id">{{ d.nome }}</option></select>
        <input v-model="filtro.de" type="date" class="input" aria-label="De" />
        <input v-model="filtro.ate" type="date" class="input" aria-label="Até" />
      </div>
      <EmptyState v-if="!dados.sessoes.length" titulo="Nenhuma sessão registrada" texto="Inicie o cronômetro ou registre uma sessão manualmente. O histórico aparece aqui.">
        <template #icone><Timer class="h-6 w-6" /></template>
      </EmptyState>
      <p v-else-if="!sessoesFiltradas.length" class="py-6 text-center text-sm text-muted">Nenhuma sessão com esses filtros.</p>
      <ul v-else class="card divide-line">
        <li v-for="s in sessoesFiltradas.slice(0, limite)" :key="s.id" class="flex items-center gap-3 p-3">
          <span class="h-9 w-1.5 shrink-0 rounded-full" :style="{ background: dados.corDisciplina(s.disciplinaId) }" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ dados.nomeDisciplina(s.disciplinaId) }}<span v-if="s.topicoId" class="font-normal text-muted"> · {{ dados.nomeTopico(s.topicoId) }}</span></p>
            <p class="truncate text-xs text-muted"><Clock class="mr-0.5 inline h-3 w-3" />{{ formatarData(s.data) }} {{ formatarHora(s.inicio) }} · {{ rotuloMetodo(s.metodo) }} · {{ dados.nomeConcurso(s.concursoId) }}<template v-if="s.manual"> · manual</template></p>
          </div>
          <span class="text-sm font-semibold tabular-nums">{{ formatarDuracao(s.duracaoSeg) }}</span>
          <button type="button" class="btn-icon" aria-label="Editar sessão" @click="editar(s)"><Pencil class="h-4 w-4" /></button>
          <button type="button" class="btn-icon" aria-label="Excluir sessão" @click="excluir(s)"><Trash2 class="h-4 w-4" /></button>
        </li>
      </ul>
      <button v-if="sessoesFiltradas.length > limite" type="button" class="btn btn-outline w-full" @click="limite += 30">Mostrar mais</button>
    </section>

    <SessaoForm v-model="formAberto" :sessao="edicao" />

    <BaseModal v-model="finalizarAberto" titulo="Finalizar sessão" largura="sm">
      <form id="form-fim" class="space-y-3" @submit.prevent="finalizar">
        <FormField rotulo="Duração a registrar (minutos)" para="fi-min" dica="Preenchido com o tempo medido. Você pode ajustar se esqueceu de pausar.">
          <input id="fi-min" v-model.number="minutosFinal" type="number" min="1" inputmode="numeric" class="input" autofocus />
        </FormField>
        <label v-if="atividadeAtiva && atividadeAtiva.status !== 'concluida'" class="flex min-h-[44px] items-center gap-2 text-sm"><input v-model="concluirAtiv" type="checkbox" class="h-4 w-4" />Marcar a atividade do cronograma como concluída</label>
      </form>
      <template #rodape>
        <button type="button" class="btn btn-outline" @click="finalizarAberto = false">Voltar</button>
        <button type="submit" form="form-fim" class="btn btn-primary">Registrar sessão</button>
      </template>
    </BaseModal>
  </div>
</template>
