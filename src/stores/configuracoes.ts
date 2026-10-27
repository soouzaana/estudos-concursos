import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Configuracoes, MetaVigente } from '@/types'
import { gravarConfiguracoes, lerConfiguracoes } from '@/db/repositorio'
import { aplicarNovaMeta, configPadrao, normalizarConfiguracoes } from '@/services/configuracoes'
import { aplicarTema, coresGrafico, type ModoEfetivo } from '@/services/tema'
import { hoje } from '@/utils/datas'
import { metaVigente } from '@/services/stats'
import { mensagemErroArmazenamento, useToast } from '@/composables/useToast'

export const useConfiguracoesStore = defineStore('configuracoes', () => {
  const config = ref<Configuracoes>(configPadrao())
  const carregada = ref(false)
  const modoAtual = ref<ModoEfetivo>('claro')
  let ouvinteSistema: (() => void) | null = null

  const metaHoje = computed(() => metaVigente(config.value.metas, hoje()))
  const coresDeGrafico = computed(() => coresGrafico(config.value.paleta, config.value.corPersonalizada, modoAtual.value))

  function aplicar() {
    modoAtual.value = aplicarTema(config.value)
  }

  async function carregar() {
    try {
      const salva = await lerConfiguracoes()
      config.value = normalizarConfiguracoes(salva)
    } catch (e) {
      useToast().erro(mensagemErroArmazenamento(e))
    }
    carregada.value = true
    aplicar()
    if (!ouvinteSistema && typeof matchMedia === 'function') {
      const mq = matchMedia('(prefers-color-scheme: dark)')
      const f = () => {
        if (config.value.modo === 'automatico') aplicar()
      }
      mq.addEventListener?.('change', f)
      ouvinteSistema = () => mq.removeEventListener?.('change', f)
    }
  }

  async function salvar(parcial: Partial<Configuracoes>) {
    const nova = normalizarConfiguracoes({ ...config.value, ...parcial })
    config.value = nova
    aplicar()
    try {
      await gravarConfiguracoes(nova)
    } catch (e) {
      useToast().erro(mensagemErroArmazenamento(e))
      throw e
    }
  }

  /** Nova meta vale a partir de hoje; os dias anteriores continuam avaliados pela meta antiga. */
  async function definirMetas(nova: Omit<MetaVigente, 'desde'>) {
    const metas = aplicarNovaMeta(config.value.metas, { ...nova, desde: hoje() })
    await salvar({ metas })
  }

  /** Recarrega do disco (após restaurar backup). */
  async function recarregar() {
    await carregar()
  }

  return { config, carregada, modoAtual, metaHoje, coresDeGrafico, carregar, salvar, definirMetas, recarregar }
})
