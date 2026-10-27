import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { EstadoCronometro, Sessao } from '@/types'
import { gravarCronometro, lerCronometro, limparCronometro } from '@/db/repositorio'
import {
  continuarCronometro, finalizarCronometro, iniciarCronometro, pausarCronometro, tempoDecorridoMs, type ParametrosInicio
} from '@/services/cronometro'
import { useDadosStore } from './dados'
import { mensagemErroArmazenamento, useToast } from '@/composables/useToast'

export const useCronometroStore = defineStore('cronometro', () => {
  const estado = ref<EstadoCronometro | null>(null)
  /** Só serve para redesenhar a tela; o tempo vem sempre de timestamps. */
  const agora = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null
  let ouvintes = false

  const ativo = computed(() => estado.value !== null)
  const rodando = computed(() => estado.value?.status === 'rodando')
  const decorridoMs = computed(() => (estado.value ? tempoDecorridoMs(estado.value, agora.value) : 0))

  function sincronizarRelogio() {
    agora.value = Date.now()
  }

  function ligarRelogio() {
    if (!timer) timer = setInterval(sincronizarRelogio, 1000)
    if (!ouvintes && typeof document !== 'undefined') {
      ouvintes = true
      // Ao voltar do segundo plano o tempo é recalculado (e o estado relido, caso outra aba tenha mexido).
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
          await carregar()
          sincronizarRelogio()
        }
      })
      window.addEventListener('focus', sincronizarRelogio)
      window.addEventListener('pageshow', sincronizarRelogio)
    }
  }

  function desligarRelogioSeInativo() {
    if (!estado.value && timer) {
      clearInterval(timer)
      timer = null
    }
  }

  async function carregar() {
    try {
      const salvo = await lerCronometro()
      estado.value = salvo ?? null
    } catch (e) {
      useToast().erro(mensagemErroArmazenamento(e))
    }
    sincronizarRelogio()
    if (estado.value) ligarRelogio()
    else desligarRelogioSeInativo()
  }

  async function persistir(novo: EstadoCronometro | null) {
    estado.value = novo
    try {
      if (novo) await gravarCronometro(novo)
      else await limparCronometro()
    } catch (e) {
      useToast().erro(mensagemErroArmazenamento(e))
      throw e
    }
    sincronizarRelogio()
    if (novo) ligarRelogio()
    else desligarRelogioSeInativo()
  }

  /** Só uma sessão ativa por vez: iniciar com outra em andamento é recusado. */
  async function iniciar(p: ParametrosInicio): Promise<boolean> {
    if (estado.value) return false
    await persistir(iniciarCronometro(p))
    const dados = useDadosStore()
    if (p.atividadeId) {
      const a = dados.atividadePorId(p.atividadeId)
      if (a && a.status === 'pendente') await dados.iniciar(a.id)
    }
    return true
  }

  async function pausar() {
    if (estado.value) await persistir(pausarCronometro(estado.value))
  }
  async function continuar() {
    if (estado.value) await persistir(continuarCronometro(estado.value))
  }

  async function atualizarDetalhes(p: Partial<Pick<EstadoCronometro, 'concursoId' | 'disciplinaId' | 'topicoId' | 'metodo' | 'observacoes'>>) {
    if (estado.value) await persistir({ ...estado.value, ...p })
  }

  /**
   * Finaliza e grava a sessão. Retorna a sessão criada, ou null quando nada foi estudado
   * (nesse caso o cronômetro continua ativo para o usuário decidir entre editar ou descartar).
   */
  async function finalizar(opcoes: { duracaoSeg?: number; concluirAtividade?: boolean } = {}): Promise<Sessao | null> {
    const e = estado.value
    if (!e) return null
    const sessao = finalizarCronometro(e, Date.now(), opcoes.duracaoSeg)
    if (!sessao) return null
    const dados = useDadosStore()
    await dados.salvarSessao(sessao)
    await persistir(null)
    if (opcoes.concluirAtividade && e.atividadeId) await dados.concluir(e.atividadeId)
    return sessao
  }

  /** Descarta sem gravar. A confirmação é responsabilidade de quem chama. */
  async function descartar() {
    await persistir(null)
  }

  return { estado, agora, ativo, rodando, decorridoMs, carregar, iniciar, pausar, continuar, atualizarDetalhes, finalizar, descartar }
})
