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
  | 'external'
  | 'calendar'
  | 'mountain'
  | 'board'
  | 'car'
  | 'bus'
  | 'train'

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
    <path v-else-if="name === 'external'" d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
    <g v-else-if="name === 'calendar'">
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </g>
    <g v-else-if="name === 'mountain'">
      <path d="M2.5 19.5l7-12 4.5 7.5 2.5-3.5 5 8z" />
      <path d="M7.4 11l2.1 1.5 2-1.2" />
    </g>
    <g v-else-if="name === 'board'">
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M3.5 10h17M9 10v9" />
    </g>
    <g v-else-if="name === 'car'">
      <path d="M5 16.5V12l1.8-4.6A1.5 1.5 0 0 1 8.2 6.5h7.6a1.5 1.5 0 0 1 1.4.9L19 12v4.5z" />
      <path d="M5 12h14M6.5 16.5v2M17.5 16.5v2" />
      <circle cx="8.5" cy="14" r="0.6" fill="currentColor" />
      <circle cx="15.5" cy="14" r="0.6" fill="currentColor" />
    </g>
    <g v-else-if="name === 'bus'">
      <rect x="5" y="3.5" width="14" height="14" rx="2.5" />
      <path d="M5 11h14M7.5 17.5v2.5M16.5 17.5v2.5M9 7h6" />
      <circle cx="8.5" cy="14.3" r="0.6" fill="currentColor" />
      <circle cx="15.5" cy="14.3" r="0.6" fill="currentColor" />
    </g>
    <g v-else-if="name === 'train'">
      <rect x="6" y="3.5" width="12" height="13" rx="3" />
      <path d="M6 10h12M9 20.5l1.5-4M15 20.5l-1.5-4" />
      <circle cx="9.5" cy="13.3" r="0.6" fill="currentColor" />
      <circle cx="14.5" cy="13.3" r="0.6" fill="currentColor" />
    </g>
    <g v-else-if="name === 'storm'">
      <path d="M7 14.5h10.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.4A2.8 2.8 0 0 0 7 14.5z" />
      <path d="M12.5 16l-2 3.5h3l-2 3" />
    </g>
  </svg>
</template>
