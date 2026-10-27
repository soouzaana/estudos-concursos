import { useRouter } from 'vue-router'
import type { Atividade } from '@/types'
import { useCronometroStore } from '@/stores/cronometro'
import { useDadosStore } from '@/stores/dados'
import { confirmar } from './useConfirm'
import { useToast } from './useToast'

/** Ações rápidas compartilhadas por Início, Cronograma, Concurso e Calendário. */
export function useAtividadeAcoes() {
  const dados = useDadosStore()
  const cron = useCronometroStore()
  const router = useRouter()
  const toast = useToast()

  async function iniciar(a: Atividade) {
    if (cron.ativo) {
      if (cron.estado?.atividadeId === a.id) {
        router.push('/estudos')
        return
      }
      toast.info('Já existe uma sessão em andamento. Finalize ou descarte antes de iniciar outra.')
      router.push('/estudos')
      return
    }
    try {
      await cron.iniciar({
        concursoId: a.concursoId,
        disciplinaId: a.disciplinaId,
        topicoId: a.topicoId,
        atividadeId: a.id,
        metodo: 'teoria'
      })
      router.push('/estudos')
    } catch {
      /* já notificado */
    }
  }

  async function concluir(a: Atividade) {
    await dados.concluir(a.id).catch(() => undefined)
    toast.sucesso('Atividade concluída.')
  }

  async function pular(a: Atividade) {
    const ok = await confirmar({
      titulo: 'Pular esta atividade?',
      mensagem: 'Ela ficará registrada como pulada (não conta como concluída) e a próxima atividade da sequência passa a ser a sugerida.',
      confirmar: 'Pular'
    })
    if (!ok) return
    await dados.pular(a.id).catch(() => undefined)
    toast.info('Atividade marcada como pulada.')
  }

  async function reabrir(a: Atividade) {
    await dados.reabrir(a.id).catch(() => undefined)
  }

  function registrarQuestoes(a: Atividade) {
    router.push({
      path: '/questoes',
      query: { novo: '1', concurso: a.concursoId, disciplina: a.disciplinaId, ...(a.topicoId ? { topico: a.topicoId } : {}) }
    })
  }

  return { iniciar, concluir, pular, reabrir, registrarQuestoes }
}
