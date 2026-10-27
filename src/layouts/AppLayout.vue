<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import {
  BarChart3, BookOpen, CalendarDays, CalendarRange, Ellipsis, GraduationCap, House, Landmark, Layers, ListChecks, NotebookPen,
  Pause, Play, Settings, Timer
} from 'lucide-vue-next'
import { ROTAS_MENU } from '@/router'
import { useCronometroStore } from '@/stores/cronometro'
import { useDadosStore } from '@/stores/dados'
import { formatarCronometro } from '@/utils/datas'
import BaseModal from '@/components/BaseModal.vue'

const icones: Record<string, Component> = { Home: House, Landmark, BookOpen, CalendarRange, Timer, ListChecks, NotebookPen, Layers, BarChart3, CalendarDays, Settings }

const route = useRoute()
const router = useRouter()
const cron = useCronometroStore()
const dados = useDadosStore()

const principaisMobile = ['inicio', 'cronograma', 'estudos', 'questoes']
const menuMobile = computed(() => ROTAS_MENU.filter((r) => principaisMobile.includes(r.nome)))
const menuMais = computed(() => ROTAS_MENU.filter((r) => !principaisMobile.includes(r.nome)))
const abertoMais = ref(false)
watch(() => route.fullPath, () => (abertoMais.value = false))

const ativoNome = computed(() => ((route.meta.pai as string) || (route.name as string)) ?? '')
const maisAtivo = computed(() => menuMais.value.some((r) => r.nome === ativoNome.value))
const tituloPagina = computed(() => (route.meta.titulo as string) ?? '')

const descricaoCron = computed(() => {
  const e = cron.estado
  if (!e) return ''
  return [e.disciplinaId ? dados.nomeDisciplina(e.disciplinaId) : 'Estudo livre', e.concursoId ? dados.nomeConcurso(e.concursoId) : ''].filter(Boolean).join(' · ')
})
const mostrarMini = computed(() => cron.ativo && route.name !== 'estudos')
</script>

<template>
  <div class="min-h-[100dvh] lg:pl-64">
    <!-- Barra lateral (desktop) -->
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-card px-3 py-5 lg:flex">
      <div class="mb-6 flex items-center gap-3 px-3">
        <span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white"><GraduationCap class="h-5 w-5" /></span>
        <div>
          <p class="text-sm font-semibold leading-tight">Estudos</p>
          <p class="text-xs text-muted">para Concursos</p>
        </div>
      </div>
      <nav class="flex-1 space-y-0.5 overflow-y-auto" aria-label="Principal">
        <RouterLink
          v-for="r in ROTAS_MENU"
          :key="r.nome"
          :to="r.caminho"
          class="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition"
          :class="ativoNome === r.nome ? 'bg-brand-100 text-accent dark:bg-brand-900/50' : 'text-muted hover:bg-line/50 hover:text-ink'"
          :aria-current="ativoNome === r.nome ? 'page' : undefined"
        >
          <component :is="icones[r.icone]" class="h-[18px] w-[18px]" />{{ r.rotulo }}
        </RouterLink>
      </nav>
      <p class="px-3 pt-3 text-[11px] leading-snug text-muted">Dados salvos apenas neste dispositivo. Faça backups em Configurações.</p>
    </aside>

    <!-- Cabeçalho (mobile) -->
    <header class="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden" style="padding-top: max(0.75rem, env(safe-area-inset-top))">
      <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white"><GraduationCap class="h-4 w-4" /></span>
      <h1 class="text-base font-semibold">{{ tituloPagina }}</h1>
    </header>

    <!-- Mini cronômetro -->
    <Transition name="fade">
      <div v-if="mostrarMini" class="sticky top-[57px] z-20 mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3 lg:top-0 lg:px-8">
        <div class="flex w-full items-center gap-3 rounded-2xl bg-brand-600 px-4 py-2.5 text-white shadow-lg">
          <Timer class="h-4 w-4 shrink-0" />
          <button type="button" class="min-w-0 flex-1 text-left" @click="router.push('/estudos')" aria-label="Abrir cronômetro">
            <span class="block truncate text-xs opacity-90">{{ cron.rodando ? 'Estudando' : 'Pausado' }} · {{ descricaoCron }}</span>
            <span class="block font-mono text-lg font-semibold tabular-nums leading-tight">{{ formatarCronometro(cron.decorridoMs) }}</span>
          </button>
          <button type="button" class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30" :aria-label="cron.rodando ? 'Pausar' : 'Continuar'" @click="cron.rodando ? cron.pausar() : cron.continuar()">
            <Pause v-if="cron.rodando" class="h-4 w-4" /><Play v-else class="h-4 w-4" />
          </button>
        </div>
      </div>
    </Transition>

    <main class="mx-auto max-w-6xl px-4 pb-28 pt-4 lg:px-8 lg:pb-12 lg:pt-8">
      <RouterView v-slot="{ Component, route: r }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" :key="r.path" />
        </Transition>
      </RouterView>
    </main>

    <!-- Navegação inferior (mobile) -->
    <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur lg:hidden" aria-label="Principal">
      <ul class="safe-bottom mx-auto grid max-w-lg grid-cols-5 px-1 pt-1.5">
        <li v-for="r in menuMobile" :key="r.nome">
          <RouterLink :to="r.caminho" class="flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium" :class="ativoNome === r.nome ? 'text-accent' : 'text-muted'" :aria-current="ativoNome === r.nome ? 'page' : undefined">
            <span class="flex h-7 w-12 items-center justify-center rounded-full transition" :class="ativoNome === r.nome ? 'bg-brand-100 dark:bg-brand-900/50' : ''">
              <component :is="icones[r.icone]" class="h-5 w-5" />
            </span>
            {{ r.rotulo }}
          </RouterLink>
        </li>
        <li>
          <button type="button" class="flex min-h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium" :class="maisAtivo ? 'text-accent' : 'text-muted'" aria-haspopup="dialog" @click="abertoMais = true">
            <span class="flex h-7 w-12 items-center justify-center rounded-full" :class="maisAtivo ? 'bg-brand-100 dark:bg-brand-900/50' : ''"><Ellipsis class="h-5 w-5" /></span>
            Mais
          </button>
        </li>
      </ul>
    </nav>

    <BaseModal v-model="abertoMais" titulo="Mais seções" largura="sm">
      <ul class="grid grid-cols-2 gap-2">
        <li v-for="r in menuMais" :key="r.nome">
          <RouterLink :to="r.caminho" class="flex min-h-[56px] items-center gap-3 rounded-2xl border border-line px-3 text-sm font-medium" :class="ativoNome === r.nome ? 'bg-brand-100 text-accent dark:bg-brand-900/50' : 'bg-card'">
            <component :is="icones[r.icone]" class="h-5 w-5 shrink-0" />{{ r.rotulo }}
          </RouterLink>
        </li>
      </ul>
    </BaseModal>
  </div>
</template>
