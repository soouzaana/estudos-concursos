<script setup lang="ts">
defineProps<{ rotulo: string; erro?: string; dica?: string; para?: string }>()
</script>

<template>
  <div>
    <label class="label" :for="para">{{ rotulo }}</label>
    <slot />
    <p v-if="dica && !erro" class="mt-1 text-xs text-muted">{{ dica }}</p>
    <p v-if="erro" class="mt-1 text-xs text-rose-600 dark:text-rose-300" role="alert">{{ erro }}</p>
  </div>
</template>
