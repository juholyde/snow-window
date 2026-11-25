<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAX_CREW_NAME } from '../lib/rules'
import type { Person } from '../lib/overlap'
import type { CrewPreview } from '../lib/store'
import ProfileFields from './ProfileFields.vue'

/** First screen without a crew: start one, or join the crew an invite link points to. */
const props = defineProps<{
  profile: Person | null
  preview: CrewPreview | null
  badInvite: boolean
  canCancel: boolean
  busy: boolean
}>()
const emit = defineEmits<{
  create: [name: string, emoji: string, crewName: string]
  join: [name: string, emoji: string]
  cancel: []
  account: []
}>()

const name = ref(props.profile?.name ?? '')
const emoji = ref(props.profile?.emoji ?? '⛷️')
const crewName = ref('')
const ready = computed(() => Boolean(name.value.trim() && emoji.value.trim()))

function submit() {
  if (!ready.value) return
  if (props.preview) emit('join', name.value, emoji.value)
  else if (crewName.value.trim()) emit('create', name.value, emoji.value, crewName.value)
}
</script>

<template>
  <section class="welcome" aria-labelledby="welcome-title">
    <form class="welcome-card" @submit.prevent="submit">
      <template v-if="preview">
        <h2 id="welcome-title">Join {{ preview.name }}</h2>
        <p class="welcome-lead">
          <span class="crew-faces" aria-hidden="true">
            <span v-for="(m, i) in preview.members.slice(0, 8)" :key="i" :title="m.name">{{ m.emoji }}</span>
          </span>
          {{ preview.members.length }} {{ preview.members.length === 1 ? 'person' : 'people' }} planning ski days together.
          Mark when you're free and see when everyone is.
        </p>
      </template>
      <template v-else>
        <h2 id="welcome-title">{{ canCancel ? 'New crew' : 'Start a crew' }}</h2>
        <p v-if="badInvite" class="welcome-warn">That invite link no longer works. Ask for a new one, or start your own crew.</p>
        <p class="welcome-lead">
          A crew is the group you ski with. Everyone marks the days they're free, and the board shows when you all are.
          Invite them with a link.
        </p>
      </template>

      <ProfileFields v-if="!profile" v-model:name="name" v-model:emoji="emoji" />
      <p v-else class="welcome-as">
        <span class="avatar">{{ profile.emoji }}</span> As <strong>{{ profile.name }}</strong>
      </p>

      <label v-if="!preview" class="field">
        <span>Crew name</span>
        <input v-model="crewName" type="text" :maxlength="MAX_CREW_NAME" placeholder="Pyrenees gang" required />
      </label>

      <div class="welcome-actions">
        <button type="submit" class="primary" :disabled="busy || !ready || (!preview && !crewName.trim())">
          {{ preview ? 'Join the crew' : 'Create crew' }}
        </button>
        <button v-if="canCancel" type="button" class="ghost" @click="emit('cancel')">Cancel</button>
      </div>
      <p class="welcome-note">
        No sign-up: you start as a guest. Save your account later to use it on another device.
        <button v-if="!profile" type="button" class="link-button" @click="emit('account')">I already have an account</button>
      </p>
    </form>
  </section>
</template>
