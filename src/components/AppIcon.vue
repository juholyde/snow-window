<script setup lang="ts">
/** One stroke icon set (24px grid, 2px stroke, round joins) for controls and weather. */
export type IconName =
  | 'check'
  | 'more'
  | 'plus'
  | 'close'
  | 'sun'
  | 'partly'
  | 'cloud'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm'

withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="icon"
  >
    <path v-if="name === 'check'" d="M5 12.5l4.5 4.5L19 7.5" />
    <g v-else-if="name === 'more'">
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" />
    </g>
    <path v-else-if="name === 'plus'" d="M12 5v14M5 12h14" />
    <path v-else-if="name === 'close'" d="M6 6l12 12M18 6L6 18" />
    <g v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </g>
    <g v-else-if="name === 'partly'">
      <path d="M8 3.5v1.5M3.5 8H5M4.8 4.8l1 1M11.2 4.8l-1 1" />
      <path d="M5.6 10.6A3 3 0 0 1 10.9 7" />
      <path d="M8.5 19h9a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.4A2.8 2.8 0 0 0 8.5 19z" />
    </g>
    <path v-else-if="name === 'cloud'" d="M7 18.5h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.6A3.2 3.2 0 0 0 7 18.5z" />
    <g v-else-if="name === 'fog'">
      <path d="M7 13.5h10.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.4" />
      <path d="M4 17h16M6 20.5h12" />
    </g>
    <g v-else-if="name === 'rain'">
      <path d="M7 14.5h10.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.4A2.8 2.8 0 0 0 7 14.5z" />
      <path d="M9 17.5l-1 3M13 17.5l-1 3M17 17.5l-1 3" />
    </g>
    <g v-else-if="name === 'snow'">
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
      <path d="M9.5 4.5L12 6.5l2.5-2M9.5 19.5l2.5-2 2.5 2" />
    </g>
    <g v-else-if="name === 'storm'">
      <path d="M7 14.5h10.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.4A2.8 2.8 0 0 0 7 14.5z" />
      <path d="M12.5 16l-2 3.5h3l-2 3" />
    </g>
  </svg>
</template>
