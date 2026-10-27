import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type {
  Atividade, BlocoQuestoes, Cartao, Concurso, ConcursoDisciplina, DataISO, Disciplina, Erro, EventoCronograma, ID,
  MarcacaoDia, NotaRevisao, RevisaoCartao, Sessao, StatusConcurso, Topico
} from '@/types'
import * as repo from '@/db/repositorio'
import type { DadosStats } from '@/services/stats'
import {
  concluirAtividade, gerarAtividadesSemanais, iniciarAtividade, ordenarAtividades, pularAtividade, reabrirAtividade,
  reagendarAtividade, reagendarAtrasadas, type ParametrosGeracao, type Transicao
} from '@/services/cronograma'
import { estadoInicial, revisarCartao } from '@/services/fsrs'
import { corDaDisciplina } from '@/utils/cores'
import { hoje as hojeISO } from '@/utils/datas'
import { novoId } from '@/utils/id'
import { mensagemErroArmazenamento, useToast } from '@/composables/useToast'
import { useConfiguracoesStore } from './configuracoes'

type NovoConcurso = Omit<Concurso, 'id' | 'criadoEm' | 'atualizadoEm'> & { id?: ID }

export const useDadosStore = defineStore('dados', () => {
  const concursos = shallowRef<Concurso[]>([])
  const disciplinas = shallowRef<Disciplina[]>([])
  const concursoDisciplinas = shallowRef<ConcursoDisciplina[]>([])
  const topicos = shallowRef<Topico[]>([])
  const atividades = shallowRef<Atividade[]>([])
  const historicoCronograma = shallowRef<EventoCronograma[]>([])
  const sessoes = shallowRef<Sessao[]>([])
  const questoes = shallowRef<BlocoQuestoes[]>([])
  const erros = shallowRef<Erro[]>([])
  const cartoes = shallowRef<Cartao[]>([])
  const revisoesCartao = shallowRef<RevisaoCartao[]>([])
  const marcacoesDia = shallowRef<MarcacaoDia[]>([])
  const carregado = ref(false)
  const falhaCarga = ref<string | null>(null)

  /* ------------------------------- carga ------------------------------- */

  async function carregar() {
    try {
      const d = await repo.carregarTudo()
      concursos.value = d.concursos
      disciplinas.value = d.disciplinas
      concursoDisciplinas.value = d.concursoDisciplinas
      topicos.value = d.topicos
      atividades.value = d.atividades
      historicoCronograma.value = d.historicoCronograma
      sessoes.value = d.sessoes
      questoes.value = d.questoes
      erros.value = d.erros
      cartoes.value = d.cartoes
      revisoesCartao.value = d.revisoesCartao
      marcacoesDia.value = d.marcacoesDia
      falhaCarga.value = null
    } catch (e) {
      falhaCarga.value = mensagemErroArmazenamento(e)
      useToast().erro(falhaCarga.value)
    } finally {
      carregado.value = true
    }
  }

  /** Executa uma gravação e recarrega os dados; mostra erro amigável se o armazenamento falhar. */
  async function executar<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const r = await fn()
      await carregar()
      return r
    } catch (e) {
      useToast().erro(mensagemErroArmazenamento(e))
      throw e
    }
  }

  /* ------------------------------ derivados ---------------------------- */

  const concursoPorId = computed(() => new Map(concursos.value.map((c) => [c.id, c])))
  const disciplinaPorId = computed(() => new Map(disciplinas.value.map((d) => [d.id, d])))
  const topicoPorId = computed(() => new Map(topicos.value.map((t) => [t.id, t])))
  const disciplinasAtivas = computed(() => disciplinas.value.filter((d) => !d.arquivada).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)))
  const concursosAbertos = computed(() => concursos.value.filter((c) => c.status === 'preparacao'))

  const dadosStats = computed<DadosStats>(() => ({
    concursos: concursos.value,
    disciplinas: disciplinas.value,
    concursoDisciplinas: concursoDisciplinas.value,
    topicos: topicos.value,
    atividades: atividades.value,
    sessoes: sessoes.value,
    questoes: questoes.value,
    erros: erros.value,
    cartoes: cartoes.value,
    revisoesCartao: revisoesCartao.value,
    marcacoesDia: marcacoesDia.value
  }))

  const nomeConcurso = (id?: ID) => (id ? (concursoPorId.value.get(id)?.nome ?? 'Concurso removido') : 'Geral (sem concurso)')
  const nomeDisciplina = (id?: ID) => (id ? (disciplinaPorId.value.get(id)?.nome ?? 'Disciplina removida') : 'Sem disciplina')
  const nomeTopico = (id?: ID) => (id ? (topicoPorId.value.get(id)?.nome ?? 'Tópico removido') : '')
  const corDisciplina = (id?: ID) => (id ? (disciplinaPorId.value.get(id)?.cor ?? '#94a3b8') : '#94a3b8')

  function disciplinasDoConcurso(concursoId: ID): Disciplina[] {
    return concursoDisciplinas.value
      .filter((r) => r.concursoId === concursoId)
      .sort((a, b) => a.ordem - b.ordem)
      .map((r) => disciplinaPorId.value.get(r.disciplinaId))
      .filter((d): d is Disciplina => !!d && !d.arquivada)
  }
  function concursosDaDisciplina(disciplinaId: ID): Concurso[] {
    return concursoDisciplinas.value
      .filter((r) => r.disciplinaId === disciplinaId)
      .map((r) => concursoPorId.value.get(r.concursoId))
      .filter((c): c is Concurso => !!c)
  }
  function topicosDaDisciplina(disciplinaId: ID, incluirArquivados = false): Topico[] {
    return topicos.value
      .filter((t) => t.disciplinaId === disciplinaId && (incluirArquivados || !t.arquivado))
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
  }
  function atividadesDoConcurso(concursoId?: ID): Atividade[] {
    return ordenarAtividades(concursoId ? atividades.value.filter((a) => a.concursoId === concursoId) : atividades.value)
  }

  /* ------------------------------ concursos ---------------------------- */

  async function salvarConcurso(entrada: NovoConcurso, disciplinaIds?: ID[]): Promise<Concurso> {
    const agora = Date.now()
    const existente = entrada.id ? concursoPorId.value.get(entrada.id) : undefined
    const c: Concurso = { ...entrada, id: entrada.id ?? novoId(), criadoEm: existente?.criadoEm ?? agora, atualizadoEm: agora }
    await executar(() => repo.salvarConcurso(c, disciplinaIds))
    return c
  }
  const alterarStatusConcurso = (id: ID, status: StatusConcurso) => {
    const c = concursoPorId.value.get(id)
    if (!c) return Promise.resolve()
    return executar(() => repo.salvarConcurso({ ...c, status, atualizadoEm: Date.now() }))
  }
  const excluirConcurso = (id: ID) => executar(() => repo.excluirConcurso(id))

  /* ----------------------------- disciplinas --------------------------- */

  async function criarDisciplina(nome: string, concursoId?: ID, extra: Partial<Disciplina> = {}): Promise<Disciplina> {
    const nomeLimpo = nome.trim()
    const igual = disciplinas.value.find((d) => d.nome.trim().toLowerCase() === nomeLimpo.toLowerCase() && !d.arquivada)
    if (igual) {
      if (concursoId) await executar(() => repo.vincularDisciplina(concursoId, igual.id))
      return igual
    }
    const d: Disciplina = {
      id: novoId(), nome: nomeLimpo, descricao: '', cor: corDaDisciplina(disciplinas.value.length), ordem: disciplinas.value.length,
      status: 'nao_iniciado', observacoes: '', criadoEm: Date.now(), ...extra
    }
    await executar(async () => {
      await repo.salvarDisciplina(d)
      if (concursoId) await repo.vincularDisciplina(concursoId, d.id)
    })
    return d
  }
  const atualizarDisciplina = (d: Disciplina) => executar(() => repo.salvarDisciplina(d))
  const excluirDisciplina = (id: ID) => executar(() => repo.excluirDisciplina(id))
  const restaurarDisciplina = (id: ID) => executar(() => repo.restaurarDisciplina(id))
  const vincularDisciplina = (concursoId: ID, disciplinaId: ID) => executar(() => repo.vincularDisciplina(concursoId, disciplinaId))
  const desvincularDisciplina = (concursoId: ID, disciplinaId: ID) => executar(() => repo.desvincularDisciplina(concursoId, disciplinaId))
  const reordenarDisciplinasDoConcurso = (concursoId: ID, ids: ID[]) => executar(() => repo.reordenarDisciplinasDoConcurso(concursoId, ids))
  const temHistoricoDisciplina = (id: ID) => repo.disciplinaTemHistorico(id)

  async function reordenarDisciplinas(idsEmOrdem: ID[]) {
    const mapa = disciplinaPorId.value
    await executar(async () => {
      for (let i = 0; i < idsEmOrdem.length; i++) {
        const d = mapa.get(idsEmOrdem[i])
        if (d && d.ordem !== i) await repo.salvarDisciplina({ ...d, ordem: i })
      }
    })
  }

  /* ------------------------------- tópicos ----------------------------- */

  async function criarTopico(disciplinaId: ID, nome: string, parentId?: ID): Promise<Topico> {
    const irmaos = topicos.value.filter((t) => t.disciplinaId === disciplinaId && t.parentId === parentId && !t.arquivado)
    const t: Topico = { id: novoId(), disciplinaId, parentId, nome: nome.trim(), ordem: irmaos.length, status: 'nao_iniciado', observacoes: '' }
    await executar(() => repo.salvarTopico(t))
    return t
  }
  const atualizarTopico = (t: Topico) => executar(() => repo.salvarTopico(t))
  const excluirTopico = (id: ID) => executar(() => repo.excluirTopico(id))
  async function reordenarTopicos(idsEmOrdem: ID[]) {
    const mapa = topicoPorId.value
    const alterados: Topico[] = []
    idsEmOrdem.forEach((id, i) => {
      const t = mapa.get(id)
      if (t && t.ordem !== i) alterados.push({ ...t, ordem: i })
    })
    if (alterados.length) await executar(() => repo.salvarTopicos(alterados))
  }

  /* ------------------------------ cronograma --------------------------- */

  async function criarAtividade(p: Omit<Atividade, 'id' | 'criadoEm' | 'atualizadoEm' | 'ordem' | 'status'> & { status?: Atividade['status'] }): Promise<Atividade> {
    const agora = Date.now()
    const maxOrdem = atividades.value.filter((a) => a.concursoId === p.concursoId).reduce((m, a) => Math.max(m, a.ordem), -1)
    const a: Atividade = { ...p, status: p.status ?? 'pendente', id: novoId(), ordem: maxOrdem + 1, criadoEm: agora, atualizadoEm: agora }
    await executar(() => repo.salvarAtividade(a, { tipo: 'criada', detalhe: `Atividade criada para ${a.dataPlanejada}` }))
    return a
  }

  /** Edição de campos de planejamento. Sessões e estatísticas já registradas não são tocadas. */
  async function atualizarAtividade(a: Atividade) {
    const antes = atividades.value.find((x) => x.id === a.id)
    const mudou = antes ? descreverMudancas(antes, a) : 'Atividade editada'
    await executar(() => repo.salvarAtividade({ ...a, atualizadoEm: Date.now() }, { tipo: 'editada', detalhe: mudou || 'Atividade editada' }))
  }

  async function aplicarTransicao(t: Transicao | null) {
    if (!t) return
    await executar(() => repo.salvarAtividade(t.atividade, t.evento))
  }
  const iniciar = (id: ID) => aplicarTransicao(iniciarAtividade(atividadePorId(id)!))
  const concluir = (id: ID) => aplicarTransicao(concluirAtividade(atividadePorId(id)!, hojeISO()))
  const pular = (id: ID) => aplicarTransicao(pularAtividade(atividadePorId(id)!))
  const reabrir = (id: ID) => aplicarTransicao(reabrirAtividade(atividadePorId(id)!))
  const reagendar = (id: ID, data: DataISO) => aplicarTransicao(reagendarAtividade(atividadePorId(id)!, data))
  const atividadePorId = (id: ID) => atividades.value.find((a) => a.id === id)

  /** Ação explícita: leva as atividades abertas e atrasadas para hoje. Retorna quantas foram reagendadas. */
  async function reagendarAtrasadasParaHoje(concursoId?: ID): Promise<number> {
    const base = concursoId ? atividades.value.filter((a) => a.concursoId === concursoId) : atividades.value
    const ts = reagendarAtrasadas(base, hojeISO())
    if (ts.length) await executar(() => repo.salvarAtividades(ts.map((t) => ({ atividade: t.atividade, evento: t.evento }))))
    return ts.length
  }

  async function gerarCronograma(p: Omit<ParametrosGeracao, 'ordemInicial'>): Promise<number> {
    const maxOrdem = atividades.value.filter((a) => a.concursoId === p.concursoId).reduce((m, a) => Math.max(m, a.ordem), -1)
    const lista = gerarAtividadesSemanais({ ...p, ordemInicial: maxOrdem + 1 })
    if (lista.length) {
      await executar(() => repo.salvarAtividades(lista.map((atividade) => ({ atividade, evento: { tipo: 'criada' as const, detalhe: 'Criada pelo gerador de cronograma' } }))))
    }
    return lista.length
  }
  const excluirAtividade = (a: Atividade) => executar(() => repo.excluirAtividade(a))

  /* ------------------------------- sessões ----------------------------- */

  const salvarSessao = (s: Sessao) => executar(() => repo.salvarSessao(s))
  const excluirSessao = (id: ID) => executar(() => repo.excluirSessao(id))

  /* ------------------------------- questões ---------------------------- */

  async function salvarBloco(b: Omit<BlocoQuestoes, 'id' | 'criadoEm'> & { id?: ID }): Promise<BlocoQuestoes> {
    const existente = b.id ? questoes.value.find((x) => x.id === b.id) : undefined
    const bloco: BlocoQuestoes = { ...b, id: b.id ?? novoId(), criadoEm: existente?.criadoEm ?? Date.now() }
    await executar(() => repo.salvarBlocoQuestoes(bloco))
    return bloco
  }
  const excluirBloco = (id: ID) => executar(() => repo.excluirBlocoQuestoes(id))

  /* --------------------------------- erros ----------------------------- */

  async function salvarErro(e: Omit<Erro, 'id' | 'criadoEm' | 'revisoes' | 'statusRevisao' | 'arquivado'> & Partial<Erro>): Promise<Erro> {
    const existente = e.id ? erros.value.find((x) => x.id === e.id) : undefined
    const erro: Erro = {
      statusRevisao: 'pendente', arquivado: false, revisoes: [], ...existente, ...e,
      id: e.id ?? novoId(), criadoEm: existente?.criadoEm ?? Date.now()
    } as Erro
    await executar(() => repo.salvarErro(erro))
    return erro
  }
  async function marcarErroRevisado(id: ID, nota = '') {
    const e = erros.value.find((x) => x.id === id)
    if (!e) return
    await executar(() => repo.salvarErro({ ...e, statusRevisao: 'revisado', revisoes: [...e.revisoes, { em: Date.now(), nota }] }))
  }
  async function reabrirErro(id: ID) {
    const e = erros.value.find((x) => x.id === id)
    if (e) await executar(() => repo.salvarErro({ ...e, statusRevisao: 'pendente' }))
  }
  async function arquivarErro(id: ID, arquivado = true) {
    const e = erros.value.find((x) => x.id === id)
    if (e) await executar(() => repo.salvarErro({ ...e, arquivado }))
  }
  const excluirErro = (id: ID) => executar(() => repo.excluirErro(id))

  /* ------------------------------ flashcards --------------------------- */

  async function criarCartao(c: Partial<Cartao> & Pick<Cartao, 'frente' | 'verso'>): Promise<Cartao> {
    const agora = Date.now()
    const fsrs = estadoInicial(agora)
    const cartao: Cartao = {
      concursoIds: [], tags: [], dificuldade: 'media', arquivado: false, ...c,
      id: c.id ?? novoId(), criadoEm: c.criadoEm ?? agora, fsrs: c.fsrs ?? fsrs, proximaRevisao: c.proximaRevisao ?? fsrs.due
    }
    await executar(() => repo.salvarCartao(cartao))
    return cartao
  }
  const atualizarCartao = (c: Cartao) => executar(() => repo.salvarCartao(c))
  const excluirCartao = (id: ID) => executar(() => repo.excluirCartao(id))

  async function revisar(id: ID, nota: NotaRevisao): Promise<Cartao | undefined> {
    const c = cartoes.value.find((x) => x.id === id)
    if (!c) return undefined
    const { cartao, revisao } = revisarCartao(c, nota, Date.now(), useConfiguracoesStore().config.retencaoDesejada)
    await executar(() => repo.registrarRevisaoCartao(cartao, revisao))
    return cartao
  }

  async function criarCartaoDeErro(erroId: ID): Promise<Cartao | null> {
    const e = erros.value.find((x) => x.id === erroId)
    if (!e) return null
    const ja = cartoes.value.find((c) => c.origemErroId === erroId)
    if (ja) return ja
    const resposta = [e.respostaCorreta && `Resposta correta: ${e.respostaCorreta}`, e.explicacao].filter(Boolean).join('\n\n')
    return criarCartao({
      frente: e.enunciado, verso: resposta || '(sem explicação cadastrada)', disciplinaId: e.disciplinaId, topicoId: e.topicoId,
      concursoIds: [...e.concursoIds], tags: [...e.tags], dificuldade: e.dificuldade, origemErroId: e.id
    })
  }

  /* ------------------------------ marcações ---------------------------- */

  const marcarDiaPulado = (data: DataISO, motivo = '') => executar(() => repo.marcarDiaPulado({ data, tipo: 'pulado', motivo }))
  const removerMarcacaoDia = (data: DataISO) => executar(() => repo.removerMarcacaoDia(data))

  return {
    concursos, disciplinas, concursoDisciplinas, topicos, atividades, historicoCronograma, sessoes, questoes, erros, cartoes,
    revisoesCartao, marcacoesDia, carregado, falhaCarga,
    concursoPorId, disciplinaPorId, topicoPorId, disciplinasAtivas, concursosAbertos, dadosStats,
    nomeConcurso, nomeDisciplina, nomeTopico, corDisciplina,
    disciplinasDoConcurso, concursosDaDisciplina, topicosDaDisciplina, atividadesDoConcurso, atividadePorId,
    carregar, salvarConcurso, alterarStatusConcurso, excluirConcurso,
    criarDisciplina, atualizarDisciplina, excluirDisciplina, restaurarDisciplina, vincularDisciplina, desvincularDisciplina,
    reordenarDisciplinasDoConcurso, reordenarDisciplinas, temHistoricoDisciplina,
    criarTopico, atualizarTopico, excluirTopico, reordenarTopicos,
    criarAtividade, atualizarAtividade, iniciar, concluir, pular, reabrir, reagendar, reagendarAtrasadasParaHoje, gerarCronograma, excluirAtividade,
    salvarSessao, excluirSessao,
    salvarBloco, excluirBloco,
    salvarErro, marcarErroRevisado, reabrirErro, arquivarErro, excluirErro,
    criarCartao, atualizarCartao, excluirCartao, revisar, criarCartaoDeErro,
    marcarDiaPulado, removerMarcacaoDia
  }
})

function descreverMudancas(a: Atividade, b: Atividade): string {
  const partes: string[] = []
  if (a.dataPlanejada !== b.dataPlanejada) partes.push(`data planejada ${a.dataPlanejada} → ${b.dataPlanejada}`)
  if (a.disciplinaId !== b.disciplinaId) partes.push('disciplina alterada')
  if (a.topicoId !== b.topicoId) partes.push('tópico alterado')
  if ((a.horario ?? '') !== (b.horario ?? '')) partes.push(`horário ${a.horario || '—'} → ${b.horario || '—'}`)
  if (a.duracaoMin !== b.duracaoMin) partes.push(`duração ${a.duracaoMin} → ${b.duracaoMin} min`)
  if (a.questoesPrevistas !== b.questoesPrevistas) partes.push(`questões previstas ${a.questoesPrevistas} → ${b.questoesPrevistas}`)
  if (a.prioridade !== b.prioridade) partes.push(`prioridade ${a.prioridade} → ${b.prioridade}`)
  if (a.observacoes !== b.observacoes) partes.push('observações alteradas')
  return partes.join('; ')
}
