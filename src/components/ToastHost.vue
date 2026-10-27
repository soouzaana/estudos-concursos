<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
const { itens, remover } = useToast()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-4 lg:top-auto lg:items-end lg:pr-6" aria-live="polite" role="status">
    <TransitionGroup name="list">
      <div
        v-for="t in itens"
        :key="t.id"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg"
        :class="{
          'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100': t.tipo === 'sucesso',
          'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100': t.tipo === 'erro',
          'border-line bg-card text-ink': t.tipo === 'info'
        }"
      >
        <CheckCircle2 v-if="t.tipo === 'sucesso'" class="mt-0.5 h-4 w-4 shrink-0" />
        <AlertTriangle v-else-if="t.tipo === 'erro'" class="mt-0.5 h-4 w-4 shrink-0" />
        <Info v-else class="mt-0.5 h-4 w-4 shrink-0" />
        <span class="flex-1 leading-snug">{{ t.texto }}</span>
        <button type="button" class="-mr-1 rounded p-0.5 opacity-60 hover:opacity-100" aria-label="Dispensar" @click="remover(t.id)"><X class="h-4 w-4" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>
