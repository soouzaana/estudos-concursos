<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { AlertTriangle, Download, HardDrive, Trash2, Upload } from 'lucide-vue-next'
import type { Configuracoes, ModoTema, PaletaTema } from '@/types'
import { useConfiguracoesStore } from '@/stores/configuracoes'
import { useDadosStore } from '@/stores/dados'
import { useCronometroStore } from '@/stores/cronometro'
import { PALETAS } from '@/services/configuracoes'
import {
  FORMATO_ATUAL,
  lerBackup,
  montarBackup,
  nomeArquivoBackup,
  restaurarBackup,
  serializarBackup,
  type ResultadoLeitura
} from '@/services/backup'
import { apagarTudo, estimativaArmazenamento, pedirArmazenamentoPersistente } from '@/db/repositorio'
import { confirmar } from '@/composables/useConfirm'
import { mensagemErroArmazenamento, useToast } from '@/composables/useToast'
import { formatarData } from '@/utils/datas'
import FormField from '@/components/FormField.vue'

const store = useConfiguracoesStore()
const dados = useDadosStore()
const cron = useCronometroStore()
const toast = useToast()

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MODOS: { valor: ModoTema; rotulo: string }[] = [
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
  { valor: 'automatico', rotulo: 'Automático' }
]

/* --------------------------------- aparência -------------------------------- */

async function definirTema(parcial: Partial<Pick<Configuracoes, 'modo' | 'paleta' | 'corPersonalizada'>>) {
  await store.salvar(parcial).catch(() => undefined)
}

/* ----------------------------------- metas ---------------------------------- */

const metas = reactive({ diariaH: 2, semanalH: 10, questoes: 20 })
function carregarMetas() {
  const m = store.metaHoje
  metas.diariaH = +(m.metaDiariaMin / 60).toFixed(2)
  metas.semanalH = +(m.metaSemanalMin / 60).toFixed(2)
  metas.questoes = m.metaQuestoesDia
}
const erroMetas = computed(() => {
  if (![metas.diariaH, metas.semanalH, metas.questoes].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return 'Use apenas valores iguais ou maiores que zero.'
  if (metas.diariaH > 24) return 'A meta diária não pode passar de 24 horas.'
  if (metas.semanalH > 168) return 'A meta semanal não pode passar de 168 horas.'
  return ''
})
async function salvarMetas() {
  if (erroMetas.value) return
  await store
    .definirMetas({
      metaDiariaMin: Math.round(metas.diariaH * 60),
      metaSemanalMin: Math.round(metas.semanalH * 60),
      metaQuestoesDia: Math.round(metas.questoes)
    })
    .then(() => toast.sucesso('Metas atualizadas a partir de hoje. Os dias anteriores continuam com a meta antiga.'))
    .catch(() => undefined)
}
const historicoMetas = computed(() => [...store.config.metas].reverse())

/* ------------------------------ rotina e preferências ----------------------- */

const form = reactive({
  diasDisponiveis: [...store.config.diasDisponiveis],
  horariosPreferidos: store.config.horariosPreferidos,
  tempoPadraoSessaoMin: store.config.tempoPadraoSessaoMin,
  intervaloMin: store.config.intervaloMin,
  duracaoPadraoAtividadeMin: store.config.duracaoPadraoAtividadeMin,
  atrasadas: store.config.atrasadas,
  novosCartoesPorDia: store.config.novosCartoesPorDia,
  retencaoPct: Math.round(store.config.retencaoDesejada * 100)
})
function alternarDia(d: number) {
  const i = form.diasDisponiveis.indexOf(d)
  if (i >= 0) form.diasDisponiveis.splice(i, 1)
  else form.diasDisponiveis.push(d)
}
const erroPref = computed(() => {
  if (form.tempoPadraoSessaoMin < 1 || form.tempoPadraoSessaoMin > 600) return 'Tempo padrão da sessão: entre 1 e 600 minutos.'
  if (form.intervaloMin < 0 || form.intervaloMin > 240) return 'Intervalo: entre 0 e 240 minutos.'
  if (form.duracaoPadraoAtividadeMin < 5 || form.duracaoPadraoAtividadeMin > 600) return 'Duração padrão da atividade: entre 5 e 600 minutos.'
  if (form.novosCartoesPorDia < 0 || form.novosCartoesPorDia > 500) return 'Novos cartões por dia: entre 0 e 500.'
  if (form.retencaoPct < 70 || form.retencaoPct > 99) return 'Retenção desejada: entre 70% e 99%.'
  return ''
})
async function salvarPreferencias() {
  if (erroPref.value) return
  await store
    .salvar({
      diasDisponiveis: [...form.diasDisponiveis].sort(),
      horariosPreferidos: form.horariosPreferidos.trim(),
      tempoPadraoSessaoMin: form.tempoPadraoSessaoMin,
      intervaloMin: form.intervaloMin,
      duracaoPadraoAtividadeMin: form.duracaoPadraoAtividadeMin,
      atrasadas: form.atrasadas,
      novosCartoesPorDia: form.novosCartoesPorDia,
      retencaoDesejada: form.retencaoPct / 100
    })
    .then(() => toast.sucesso('Preferências salvas.'))
    .catch(() => undefined)
}

/* --------------------------------- backup ----------------------------------- */

const lendo = ref(false)
const analise = ref<ResultadoLeitura | null>(null)
const nomeArquivo = ref('')
const entrada = ref<HTMLInputElement | null>(null)
const ROTULOS_TABELA: Record<string, string> = {
  concursos: 'Concursos', disciplinas: 'Disciplinas', concursoDisciplinas: 'Vínculos concurso–disciplina', topicos: 'Tópicos',
  atividades: 'Atividades do cronograma', historicoCronograma: 'Histórico do cronograma', sessoes: 'Sessões de estudo',
  questoes: 'Blocos de questões', erros: 'Erros', cartoes: 'Flashcards', revisoesCartao: 'Revisões de flashcards', marcacoesDia: 'Dias marcados como pulados'
}

async function exportar() {
  try {
    const backup = await montarBackup()
    const blob = new Blob([serializarBackup(backup)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nomeArquivoBackup()
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast.sucesso('Backup gerado. Guarde o arquivo em um lugar seguro.')
  } catch (e) {
    toast.erro(`Não foi possível gerar o backup: ${(e as Error).message}`)
  }
}

async function escolherArquivo(ev: Event) {
  const input = ev.target as HTMLInputElement
  const arquivo = input.files?.[0]
  input.value = ''
  analise.value = null
  if (!arquivo) return
  nomeArquivo.value = arquivo.name
  lendo.value = true
  try {
    if (arquivo.size > 100 * 1024 * 1024) {
      analise.value = { ok: false, erros: ['O arquivo é grande demais para ser um backup deste aplicativo.'], avisos: [], contagens: {} }
      return
    }
    analise.value = lerBackup(await arquivo.text())
  } catch {
    analise.value = { ok: false, erros: ['Não foi possível ler o arquivo selecionado.'], avisos: [], contagens: {} }
  } finally {
    lendo.value = false
  }
}

async function restaurar() {
  const a = analise.value
  if (!a?.ok || !a.backup) return
  const total = Object.values(a.contagens).reduce((s, n) => s + n, 0)
  const ok = await confirmar({
    titulo: 'Substituir todos os dados atuais?',
    mensagem: `Os dados deste dispositivo serão SUBSTITUÍDOS pelos ${total} registro(s) do arquivo "${nomeArquivo.value}". Esta ação não pode ser desfeita. Se tiver dúvidas, exporte um backup dos dados atuais antes.`,
    confirmar: 'Substituir dados',
    perigo: true
  })
  if (!ok) return
  try {
    await restaurarBackup(a.backup)
    await Promise.all([store.recarregar(), dados.carregar(), cron.carregar()])
    carregarMetas()
    analise.value = null
    toast.sucesso('Backup restaurado com sucesso.')
  } catch (e) {
    toast.erro(`A restauração falhou e seus dados atuais foram mantidos. ${mensagemErroArmazenamento(e)}`)
  }
}

async function apagar() {
  const ok = await confirmar({
    titulo: 'Apagar todos os dados?',
    mensagem: 'Concursos, cronogramas, sessões, questões, erros, flashcards e configurações deste dispositivo serão removidos. Exporte um backup antes se quiser guardar algo.',
    confirmar: 'Apagar tudo',
    perigo: true
  })
  if (!ok) return
  const segunda = await confirmar({ titulo: 'Tem certeza?', mensagem: 'Esta é a última confirmação. Não há como recuperar os dados depois.', confirmar: 'Sim, apagar', perigo: true })
  if (!segunda) return
  try {
    await apagarTudo()
    await Promise.all([store.recarregar(), dados.carregar(), cron.carregar()])
    carregarMetas()
    toast.info('Todos os dados foram apagados.')
  } catch (e) {
    toast.erro(mensagemErroArmazenamento(e))
  }
}

/* ------------------------------- armazenamento ------------------------------ */

const armazenamento = ref<{ usado: number; cota: number } | null>(null)
const persistente = ref<boolean | null>(null)
const mb = (n: number) => (n / 1024 / 1024).toFixed(1).replace('.', ',')
async function pedirPersistencia() {
  persistente.value = await pedirArmazenamentoPersistente()
  toast[persistente.value ? 'sucesso' : 'info'](persistente.value ? 'Armazenamento protegido contra limpeza automática.' : 'O navegador não concedeu armazenamento persistente. Faça backups com frequência.')
}

onMounted(async () => {
  carregarMetas()
  armazenamento.value = await estimativaArmazenamento()
  try {
    persistente.value = (await navigator.storage?.persisted?.()) ?? null
  } catch {
    persistente.value = null
  }
})
watch(() => store.metaHoje, carregarMetas)
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-5">
    <div>
      <h1 class="page-title hidden lg:block">Configurações</h1>
      <p class="text-sm text-muted">Aparência, metas, rotina e backup dos seus dados.</p>
    </div>

    <section class="card card-pad space-y-4" aria-labelledby="t-aparencia">
      <h2 id="t-aparencia" class="section-title">Aparência</h2>
      <div>
        <p class="label">Modo</p>
        <div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Modo de cor">
          <button
            v-for="m in MODOS"
            :key="m.valor"
            type="button"
            role="radio"
            :aria-checked="store.config.modo === m.valor"
            class="btn btn-outline"
            :class="store.config.modo === m.valor && 'ring-2 ring-brand-500'"
            @click="definirTema({ modo: m.valor })"
          >{{ m.rotulo }}</button>
        </div>
      </div>
      <div>
        <p class="label">Cor do tema</p>
        <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor do tema">
          <button
            v-for="p in PALETAS"
            :key="p.valor"
            type="button"
            role="radio"
            :aria-checked="store.config.paleta === p.valor"
            :aria-label="p.rotulo"
            class="flex min-h-[44px] items-center gap-2 rounded-xl border border-line bg-card px-3 text-sm"
            :class="store.config.paleta === (p.valor as PaletaTema) && 'ring-2 ring-brand-500'"
            @click="definirTema({ paleta: p.valor })"
          >
            <span class="h-5 w-5 rounded-full border border-black/10" :style="{ background: p.cor }" aria-hidden="true" />{{ p.rotulo }}
          </button>
          <label
            class="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-3 text-sm"
            :class="store.config.paleta === 'personalizada' && 'ring-2 ring-brand-500'"
          >
            <input
              type="color"
              class="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              :value="store.config.corPersonalizada"
              aria-label="Escolher cor personalizada"
              @input="definirTema({ paleta: 'personalizada', corPersonalizada: ($event.target as HTMLInputElement).value })"
            />
            Personalizada
          </label>
        </div>
        <p class="mt-2 text-xs text-muted">A escolha é aplicada em todo o app e fica salva neste dispositivo.</p>
      </div>
    </section>

    <form class="card card-pad space-y-4" aria-labelledby="t-metas" @submit.prevent="salvarMetas">
      <div>
        <h2 id="t-metas" class="section-title">Metas</h2>
        <p class="text-xs text-muted">Alterar uma meta vale a partir de hoje: o que você já registrou continua sendo comparado com a meta que valia na época.</p>
      </div>
      <div class="grid gap-3 sm:grid-cols-3">
        <FormField rotulo="Meta diária (horas)" para="m-dia"><input id="m-dia" v-model.number="metas.diariaH" class="input" type="number" min="0" max="24" step="0.25" inputmode="decimal" /></FormField>
        <FormField rotulo="Meta semanal (horas)" para="m-sem"><input id="m-sem" v-model.number="metas.semanalH" class="input" type="number" min="0" max="168" step="0.5" inputmode="decimal" /></FormField>
        <FormField rotulo="Questões por dia" para="m-q"><input id="m-q" v-model.number="metas.questoes" class="input" type="number" min="0" step="1" inputmode="numeric" /></FormField>
      </div>
      <p v-if="erroMetas" class="text-xs text-rose-600 dark:text-rose-300" role="alert">{{ erroMetas }}</p>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <details class="text-xs text-muted">
          <summary class="cursor-pointer">Histórico de metas ({{ historicoMetas.length }})</summary>
          <ul class="mt-2 space-y-1">
            <li v-for="m in historicoMetas" :key="m.desde">
              {{ m.desde === '0000-01-01' ? 'Desde o início' : `A partir de ${formatarData(m.desde)}` }}: {{ +(m.metaDiariaMin / 60).toFixed(2) }} h/dia · {{ +(m.metaSemanalMin / 60).toFixed(2) }} h/semana · {{ m.metaQuestoesDia }} questões/dia
            </li>
          </ul>
        </details>
        <button class="btn btn-primary" type="submit" :disabled="!!erroMetas">Salvar metas</button>
      </div>
    </form>

    <form class="card card-pad space-y-4" aria-labelledby="t-rotina" @submit.prevent="salvarPreferencias">
      <h2 id="t-rotina" class="section-title">Rotina e preferências</h2>
      <div>
        <p class="label">Dias disponíveis para estudar</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(nome, i) in DIAS"
            :key="i"
            type="button"
            class="btn btn-sm"
            :class="form.diasDisponiveis.includes(i) ? 'btn-primary' : 'btn-outline'"
            :aria-pressed="form.diasDisponiveis.includes(i)"
            @click="alternarDia(i)"
          >{{ nome }}</button>
        </div>
        <p class="mt-1 text-xs text-muted">Dias fora da lista não contam como "sem estudo" na taxa de consistência.</p>
      </div>
      <FormField rotulo="Horários preferenciais" para="p-hor" dica="Texto livre. Ex.: manhã cedo e depois das 20h."><input id="p-hor" v-model="form.horariosPreferidos" class="input" maxlength="120" /></FormField>
      <div class="grid gap-3 sm:grid-cols-3">
        <FormField rotulo="Tempo padrão da sessão (min)" para="p-sess"><input id="p-sess" v-model.number="form.tempoPadraoSessaoMin" class="input" type="number" min="1" max="600" inputmode="numeric" /></FormField>
        <FormField rotulo="Intervalo entre sessões (min)" para="p-int"><input id="p-int" v-model.number="form.intervaloMin" class="input" type="number" min="0" max="240" inputmode="numeric" /></FormField>
        <FormField rotulo="Duração padrão da atividade (min)" para="p-ativ"><input id="p-ativ" v-model.number="form.duracaoPadraoAtividadeMin" class="input" type="number" min="5" max="600" inputmode="numeric" /></FormField>
      </div>
      <FormField rotulo="Atividades atrasadas" para="p-atr">
        <select id="p-atr" v-model="form.atrasadas" class="input">
          <option value="manter">Manter como estão (sem mudar nada automaticamente)</option>
          <option value="oferecer_reagendar">Oferecer reagendamento quando houver atrasadas</option>
        </select>
      </FormField>
      <div class="grid gap-3 sm:grid-cols-2">
        <FormField rotulo="Novos flashcards por dia" para="p-nc"><input id="p-nc" v-model.number="form.novosCartoesPorDia" class="input" type="number" min="0" max="500" inputmode="numeric" /></FormField>
        <FormField rotulo="Retenção desejada (%)" para="p-ret" dica="Usada pelo FSRS. Valores altos geram revisões mais frequentes."><input id="p-ret" v-model.number="form.retencaoPct" class="input" type="number" min="70" max="99" inputmode="numeric" /></FormField>
      </div>
      <p v-if="erroPref" class="text-xs text-rose-600 dark:text-rose-300" role="alert">{{ erroPref }}</p>
      <div class="flex justify-end"><button class="btn btn-primary" type="submit" :disabled="!!erroPref">Salvar preferências</button></div>
    </form>

    <section class="card card-pad space-y-4" aria-labelledby="t-backup">
      <div>
        <h2 id="t-backup" class="section-title">Backup e restauração</h2>
        <p class="text-xs text-muted">Seus dados ficam apenas neste dispositivo (formato de backup v{{ FORMATO_ATUAL }}). Não há sincronização entre aparelhos: use o backup para guardar uma cópia ou levar os dados para outro dispositivo.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-primary" @click="exportar"><Download class="h-4 w-4" />Exportar backup (JSON)</button>
        <button type="button" class="btn btn-outline" @click="entrada?.click()"><Upload class="h-4 w-4" />Importar backup…</button>
        <input ref="entrada" type="file" accept="application/json,.json" class="hidden" aria-label="Arquivo de backup" @change="escolherArquivo" />
      </div>

      <p v-if="lendo" class="text-sm text-muted" role="status">Validando arquivo…</p>
      <div v-if="analise" class="rounded-xl border border-line p-3 text-sm" aria-live="polite">
        <template v-if="analise.ok">
          <p class="font-medium">Arquivo válido: {{ nomeArquivo }}</p>
          <ul class="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-2">
            <li v-for="(n, k) in analise.contagens" :key="k">{{ ROTULOS_TABELA[k] ?? k }}: <strong class="text-ink">{{ n }}</strong></li>
          </ul>
          <ul v-if="analise.avisos.length" class="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-200">
            <li v-for="(av, i) in analise.avisos" :key="i" class="flex gap-1"><AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" />{{ av }}</li>
          </ul>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class="btn btn-danger btn-sm" @click="restaurar">Substituir meus dados por este backup</button>
            <button type="button" class="btn btn-ghost btn-sm" @click="analise = null">Cancelar</button>
          </div>
        </template>
        <template v-else>
          <p class="font-medium text-rose-700 dark:text-rose-300">Não foi possível importar este arquivo. Nada foi alterado.</p>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-xs text-muted"><li v-for="(e, i) in analise.erros" :key="i">{{ e }}</li></ul>
        </template>
      </div>
    </section>

    <section class="card card-pad space-y-3" aria-labelledby="t-arm">
      <h2 id="t-arm" class="section-title">Armazenamento</h2>
      <p v-if="armazenamento" class="text-sm text-muted"><HardDrive class="mr-1 inline h-4 w-4" />{{ mb(armazenamento.usado) }} MB em uso de {{ mb(armazenamento.cota) }} MB disponíveis para este app no navegador.</p>
      <p v-else class="text-sm text-muted">Seu navegador não informa o uso de armazenamento.</p>
      <p class="text-xs text-muted">Navegadores podem limpar dados de sites que você não usa há muito tempo (no iPhone, por exemplo, após cerca de 7 dias sem abrir o app no Safari; apps adicionados à tela inicial são menos afetados). Faça backups periódicos.</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-outline btn-sm" :disabled="persistente === true" @click="pedirPersistencia">{{ persistente ? 'Armazenamento já protegido' : 'Proteger armazenamento' }}</button>
      </div>
    </section>

    <section class="card card-pad space-y-3 border-rose-200 dark:border-rose-900/50" aria-labelledby="t-perigo">
      <h2 id="t-perigo" class="section-title">Zona de risco</h2>
      <p class="text-xs text-muted">Remove todos os dados deste dispositivo. Exporte um backup antes.</p>
      <div><button type="button" class="btn btn-outline btn-sm text-rose-700 dark:text-rose-300" @click="apagar"><Trash2 class="h-4 w-4" />Apagar todos os dados</button></div>
    </section>
  </div>
</template>
