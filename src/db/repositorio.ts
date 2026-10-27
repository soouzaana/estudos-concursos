/**
 * Camada de acesso ao IndexedDB. Componentes e stores usam estas funções;
 * nenhuma outra parte do app deve tocar diretamente no Dexie.
 */
import { banco, TABELAS_DADOS, type NomeTabela } from './database'
import type {
  Atividade,
  BlocoQuestoes,
  Cartao,
  Concurso,
  ConcursoDisciplina,
  Configuracoes,
  Disciplina,
  Erro,
  EstadoCronometro,
  EventoCronograma,
  ID,
  MarcacaoDia,
  RevisaoCartao,
  Sessao,
  Topico
} from '@/types'
import { novoId } from '@/utils/id'

export interface DadosCompletos {
  concursos: Concurso[]
  disciplinas: Disciplina[]
  concursoDisciplinas: ConcursoDisciplina[]
  topicos: Topico[]
  atividades: Atividade[]
  historicoCronograma: EventoCronograma[]
  sessoes: Sessao[]
  questoes: BlocoQuestoes[]
  erros: Erro[]
  cartoes: Cartao[]
  revisoesCartao: RevisaoCartao[]
  marcacoesDia: MarcacaoDia[]
}

export const dadosVazios = (): DadosCompletos => ({
  concursos: [],
  disciplinas: [],
  concursoDisciplinas: [],
  topicos: [],
  atividades: [],
  historicoCronograma: [],
  sessoes: [],
  questoes: [],
  erros: [],
  cartoes: [],
  revisoesCartao: [],
  marcacoesDia: []
})

/* ------------------------------ leitura geral ------------------------------ */

export async function carregarTudo(): Promise<DadosCompletos> {
  const [
    concursos,
    disciplinas,
    concursoDisciplinas,
    topicos,
    atividades,
    historicoCronograma,
    sessoes,
    questoes,
    erros,
    cartoes,
    revisoesCartao,
    marcacoesDia
  ] = await Promise.all([
    banco.concursos.toArray(),
    banco.disciplinas.toArray(),
    banco.concursoDisciplinas.toArray(),
    banco.topicos.toArray(),
    banco.atividades.toArray(),
    banco.historicoCronograma.toArray(),
    banco.sessoes.toArray(),
    banco.questoes.toArray(),
    banco.erros.toArray(),
    banco.cartoes.toArray(),
    banco.revisoesCartao.toArray(),
    banco.marcacoesDia.toArray()
  ])
  return {
    concursos,
    disciplinas,
    concursoDisciplinas,
    topicos,
    atividades,
    historicoCronograma,
    sessoes,
    questoes,
    erros,
    cartoes,
    revisoesCartao,
    marcacoesDia
  }
}

/* -------------------------------- configurações ---------------------------- */

export async function lerConfig<T>(chave: string): Promise<T | undefined> {
  const r = await banco.config.get(chave)
  return r?.valor as T | undefined
}

export async function gravarConfig(chave: string, valor: unknown): Promise<void> {
  await banco.config.put({ chave, valor })
}

export async function removerConfig(chave: string): Promise<void> {
  await banco.config.delete(chave)
}

export const lerConfiguracoes = () => lerConfig<Configuracoes>('configuracoes')
export const gravarConfiguracoes = (c: Configuracoes) => gravarConfig('configuracoes', c)
export const lerCronometro = () => lerConfig<EstadoCronometro>('cronometro')
export const gravarCronometro = (e: EstadoCronometro) => gravarConfig('cronometro', e)
export const limparCronometro = () => removerConfig('cronometro')

/* --------------------------------- concursos ------------------------------- */

export async function salvarConcurso(c: Concurso, disciplinaIds?: ID[]): Promise<void> {
  await banco.transaction('rw', banco.concursos, banco.concursoDisciplinas, async () => {
    await banco.concursos.put(c)
    if (disciplinaIds) {
      const atuais = await banco.concursoDisciplinas.where('concursoId').equals(c.id).toArray()
      const manter = new Set(disciplinaIds)
      for (const rel of atuais) if (!manter.has(rel.disciplinaId)) await banco.concursoDisciplinas.delete(rel.id)
      const jaTem = new Set(atuais.map((r) => r.disciplinaId))
      let ordem = atuais.length
      for (const did of disciplinaIds) {
        if (!jaTem.has(did)) {
          await banco.concursoDisciplinas.put({ id: novoId(), concursoId: c.id, disciplinaId: did, ordem: ordem++ })
        }
      }
    }
  })
}

/**
 * Exclui o concurso e o que é exclusivamente dele (plano/cronograma e vínculos).
 * O histórico de estudo é preservado: sessões ficam sem concurso e erros/cartões/questões
 * apenas perdem a associação com este concurso.
 */
export async function excluirConcurso(id: ID): Promise<void> {
  await banco.transaction(
    'rw',
    [
      banco.concursos,
      banco.concursoDisciplinas,
      banco.atividades,
      banco.historicoCronograma,
      banco.sessoes,
      banco.questoes,
      banco.erros,
      banco.cartoes
    ],
    async () => {
      await banco.concursos.delete(id)
      await banco.concursoDisciplinas.where('concursoId').equals(id).delete()
      await banco.atividades.where('concursoId').equals(id).delete()
      await banco.historicoCronograma.where('concursoId').equals(id).delete()
      await banco.sessoes
        .where('concursoId')
        .equals(id)
        .modify((s) => {
          delete s.concursoId
        })
      for (const tabela of [banco.questoes, banco.erros, banco.cartoes] as const) {
        await (tabela as typeof banco.erros).where('concursoIds').equals(id).modify((r) => {
          r.concursoIds = r.concursoIds.filter((c) => c !== id)
        })
      }
    }
  )
}

/* -------------------------------- disciplinas ------------------------------ */

export async function salvarDisciplina(d: Disciplina): Promise<void> {
  await banco.disciplinas.put(d)
}

export async function vincularDisciplina(concursoId: ID, disciplinaId: ID): Promise<void> {
  const existe = await banco.concursoDisciplinas.where('[concursoId+disciplinaId]').equals([concursoId, disciplinaId]).first()
  if (existe) return
  const ordem = await banco.concursoDisciplinas.where('concursoId').equals(concursoId).count()
  await banco.concursoDisciplinas.put({ id: novoId(), concursoId, disciplinaId, ordem })
}

export async function desvincularDisciplina(concursoId: ID, disciplinaId: ID): Promise<void> {
  await banco.concursoDisciplinas.where('[concursoId+disciplinaId]').equals([concursoId, disciplinaId]).delete()
}

export async function reordenarDisciplinasDoConcurso(concursoId: ID, disciplinaIdsEmOrdem: ID[]): Promise<void> {
  await banco.transaction('rw', banco.concursoDisciplinas, async () => {
    const rels = await banco.concursoDisciplinas.where('concursoId').equals(concursoId).toArray()
    for (const rel of rels) {
      const i = disciplinaIdsEmOrdem.indexOf(rel.disciplinaId)
      if (i >= 0 && rel.ordem !== i) await banco.concursoDisciplinas.update(rel.id, { ordem: i })
    }
  })
}

/** Há registros de histórico que dependem desta disciplina? */
export async function disciplinaTemHistorico(id: ID): Promise<boolean> {
  const [a, s, q, e, c] = await Promise.all([
    banco.atividades.where('disciplinaId').equals(id).count(),
    banco.sessoes.where('disciplinaId').equals(id).count(),
    banco.questoes.where('disciplinaId').equals(id).count(),
    banco.erros.where('disciplinaId').equals(id).count(),
    banco.cartoes.where('disciplinaId').equals(id).count()
  ])
  return a + s + q + e + c > 0
}

/**
 * Sem histórico: remove de fato. Com histórico: arquiva (some dos seletores, mantém o nome nos registros).
 * Retorna 'excluida' ou 'arquivada'.
 */
export async function excluirDisciplina(id: ID): Promise<'excluida' | 'arquivada'> {
  if (await disciplinaTemHistorico(id)) {
    await banco.transaction('rw', banco.disciplinas, banco.concursoDisciplinas, async () => {
      await banco.disciplinas.update(id, { arquivada: true })
      await banco.concursoDisciplinas.where('disciplinaId').equals(id).delete()
    })
    return 'arquivada'
  }
  await banco.transaction('rw', banco.disciplinas, banco.concursoDisciplinas, banco.topicos, async () => {
    await banco.disciplinas.delete(id)
    await banco.concursoDisciplinas.where('disciplinaId').equals(id).delete()
    await banco.topicos.where('disciplinaId').equals(id).delete()
  })
  return 'excluida'
}

export async function restaurarDisciplina(id: ID): Promise<void> {
  await banco.disciplinas.update(id, { arquivada: false })
}

/* ---------------------------------- tópicos -------------------------------- */

export async function salvarTopico(t: Topico): Promise<void> {
  await banco.topicos.put(t)
}

export async function salvarTopicos(ts: Topico[]): Promise<void> {
  await banco.topicos.bulkPut(ts)
}

async function topicoReferenciado(id: ID): Promise<boolean> {
  const [a, s, q, e, c] = await Promise.all([
    banco.atividades.where('topicoId').equals(id).count(),
    banco.sessoes.filter((x) => x.topicoId === id).count(),
    banco.questoes.filter((x) => x.topicoId === id).count(),
    banco.erros.where('topicoId').equals(id).count(),
    banco.cartoes.where('topicoId').equals(id).count()
  ])
  return a + s + q + e + c > 0
}

/** Exclui um tópico (e subtópicos). Os que têm histórico ficam arquivados. */
export async function excluirTopico(id: ID): Promise<void> {
  const todos = await banco.topicos.toArray()
  const ids: ID[] = []
  const coletar = (pai: ID) => {
    ids.push(pai)
    todos.filter((t) => t.parentId === pai).forEach((f) => coletar(f.id))
  }
  coletar(id)
  for (const tid of ids.reverse()) {
    if (await topicoReferenciado(tid)) await banco.topicos.update(tid, { arquivado: true })
    else await banco.topicos.delete(tid)
  }
}

/* --------------------------------- cronograma ------------------------------ */

export async function salvarAtividade(a: Atividade, evento?: Omit<EventoCronograma, 'id' | 'em' | 'atividadeId' | 'concursoId'>): Promise<void> {
  await banco.transaction('rw', banco.atividades, banco.historicoCronograma, async () => {
    await banco.atividades.put(a)
    if (evento) {
      await banco.historicoCronograma.put({ id: novoId(), atividadeId: a.id, concursoId: a.concursoId, em: Date.now(), ...evento })
    }
  })
}

export async function salvarAtividades(
  itens: { atividade: Atividade; evento?: Omit<EventoCronograma, 'id' | 'em' | 'atividadeId' | 'concursoId'> }[]
): Promise<void> {
  await banco.transaction('rw', banco.atividades, banco.historicoCronograma, async () => {
    for (const { atividade, evento } of itens) {
      await banco.atividades.put(atividade)
      if (evento) {
        await banco.historicoCronograma.put({
          id: novoId(),
          atividadeId: atividade.id,
          concursoId: atividade.concursoId,
          em: Date.now(),
          ...evento
        })
      }
    }
  })
}

/**
 * Excluir uma atividade mantém o registro no histórico do cronograma.
 * As sessões já registradas permanecem intactas (apenas perdem o vínculo com a atividade).
 */
export async function excluirAtividade(a: Atividade): Promise<void> {
  await banco.transaction('rw', banco.atividades, banco.historicoCronograma, banco.sessoes, async () => {
    await banco.atividades.delete(a.id)
    await banco.sessoes
      .where('atividadeId')
      .equals(a.id)
      .modify((s) => {
        delete s.atividadeId
      })
    await banco.historicoCronograma.put({
      id: novoId(),
      atividadeId: a.id,
      concursoId: a.concursoId,
      em: Date.now(),
      tipo: 'excluida',
      detalhe: `Atividade excluída (planejada para ${a.dataPlanejada})`
    })
  })
}

/* ---------------------------------- sessões -------------------------------- */

export async function salvarSessao(s: Sessao): Promise<void> {
  await banco.sessoes.put(s)
}

export async function excluirSessao(id: ID): Promise<void> {
  await banco.sessoes.delete(id)
}

/* --------------------------------- questões -------------------------------- */

export async function salvarBlocoQuestoes(b: BlocoQuestoes): Promise<void> {
  await banco.questoes.put(b)
}

export async function excluirBlocoQuestoes(id: ID): Promise<void> {
  await banco.transaction('rw', banco.questoes, banco.erros, async () => {
    await banco.questoes.delete(id)
    // Os erros cadastrados continuam no caderno, apenas perdem o vínculo com o bloco.
    await banco.erros
      .filter((e) => e.blocoId === id)
      .modify((e) => {
        delete e.blocoId
      })
  })
}

/* ------------------------------------ erros -------------------------------- */

export async function salvarErro(e: Erro): Promise<void> {
  await banco.erros.put(e)
}

export async function excluirErro(id: ID): Promise<void> {
  await banco.transaction('rw', banco.erros, banco.cartoes, async () => {
    await banco.erros.delete(id)
    await banco.cartoes
      .where('origemErroId')
      .equals(id)
      .modify((c) => {
        delete c.origemErroId
      })
  })
}

/* --------------------------------- flashcards ------------------------------ */

export async function salvarCartao(c: Cartao): Promise<void> {
  await banco.cartoes.put(c)
}

export async function excluirCartao(id: ID): Promise<void> {
  await banco.transaction('rw', banco.cartoes, banco.revisoesCartao, async () => {
    await banco.cartoes.delete(id)
    await banco.revisoesCartao.where('cartaoId').equals(id).delete()
  })
}

export async function registrarRevisaoCartao(cartao: Cartao, revisao: RevisaoCartao): Promise<void> {
  await banco.transaction('rw', banco.cartoes, banco.revisoesCartao, async () => {
    await banco.cartoes.put(cartao)
    await banco.revisoesCartao.put(revisao)
  })
}

/* ----------------------------- marcações de dia ---------------------------- */

export async function marcarDiaPulado(m: MarcacaoDia): Promise<void> {
  await banco.marcacoesDia.put(m)
}

export async function removerMarcacaoDia(data: string): Promise<void> {
  await banco.marcacoesDia.delete(data)
}

/* ------------------------------ backup / restauração ----------------------- */

export async function exportarDados(): Promise<DadosCompletos> {
  return carregarTudo()
}

export async function exportarConfig(): Promise<Record<string, unknown>> {
  const itens = await banco.config.toArray()
  const out: Record<string, unknown> = {}
  for (const i of itens) {
    // O cronômetro em andamento é transitório e não faz parte do backup.
    if (i.chave === 'cronometro') continue
    out[i.chave] = i.valor
  }
  return out
}

/**
 * Substitui todos os dados de forma atômica: se qualquer inserção falhar a transação inteira é
 * revertida e os dados atuais permanecem intactos. A validação deve ser feita ANTES de chamar.
 */
export async function substituirDados(dados: DadosCompletos, config: Record<string, unknown>): Promise<void> {
  const tabelas = TABELAS_DADOS.map((n) => banco.table(n))
  await banco.transaction('rw', [...tabelas, banco.config], async () => {
    for (const nome of TABELAS_DADOS) {
      await banco.table(nome).clear()
    }
    for (const nome of TABELAS_DADOS) {
      const linhas = dados[nome as NomeTabela] as unknown[]
      if (linhas.length) await banco.table(nome).bulkAdd(linhas)
    }
    const cron = await banco.config.get('cronometro')
    await banco.config.clear()
    if (cron) await banco.config.put(cron)
    for (const [chave, valor] of Object.entries(config)) await banco.config.put({ chave, valor })
  })
}

/** Apaga tudo (inclusive configurações). */
export async function apagarTudo(): Promise<void> {
  const tabelas = TABELAS_DADOS.map((n) => banco.table(n))
  await banco.transaction('rw', [...tabelas, banco.config], async () => {
    for (const t of tabelas) await t.clear()
    await banco.config.clear()
  })
}

export async function estimativaArmazenamento(): Promise<{ usado: number; cota: number } | null> {
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate()
      return { usado: e.usage ?? 0, cota: e.quota ?? 0 }
    }
  } catch {
    /* ignorar */
  }
  return null
}

export async function pedirArmazenamentoPersistente(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist()
  } catch {
    /* ignorar */
  }
  return false
}
