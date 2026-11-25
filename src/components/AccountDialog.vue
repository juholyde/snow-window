<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Person } from '../lib/overlap'
import type { Session } from '../lib/store'
import AppIcon from './AppIcon.vue'
import ProfileFields from './ProfileFields.vue'

/** You: name and avatar, saving a guest account by email, signing in elsewhere, signing out. */
const props = defineProps<{ open: boolean; session: Session; profile: Person | null; busy: boolean }>()
const emit = defineEmits<{
  close: []
  profile: [name: string, emoji: string]
  save: [email: string]
  signIn: [email: string]
  signOut: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const name = ref('')
const emoji = ref('')
const email = ref('')
const mode = ref<'save' | 'signin'>('save')
function submitEmail() {
  if (mode.value === 'save') emit('save', email.value)
  else emit('signIn', email.value)
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      name.value = props.profile?.name ?? ''
      emoji.value = props.profile?.emoji ?? '⛷️'
      email.value = ''
      mode.value = props.profile ? 'save' : 'signin'
      dialog.value?.showModal()
    } else dialog.value?.close()
  },
)
</script>

<template>
  <dialog ref="dialog" class="account" aria-labelledby="account-title" @close="emit('close')">
    <div class="account-head">
      <h2 id="account-title">You</h2>
      <button type="button" class="ghost icon-only" aria-label="Close" @click="emit('close')"><AppIcon name="close" /></button>
    </div>

    <form v-if="profile" class="account-block" @submit.prevent="emit('profile', name, emoji)">
      <ProfileFields v-model:name="name" v-model:emoji="emoji" />
      <button type="submit" class="primary" :disabled="busy || !name.trim() || !emoji.trim()">Save name and avatar</button>
    </form>

    <section class="account-block" aria-labelledby="account-sync">
      <template v-if="session.guest">
        <h3 id="account-sync">{{ mode === 'save' ? 'Save your account' : 'Sign in' }}</h3>
        <p v-if="mode === 'save'" class="muted-note">
          You're a guest on this device. Add your email to keep your crews if you clear the browser, and to sign in on your phone.
        </p>
        <p v-else class="muted-note">Already saved an account? We'll email you a sign-in link. This device's guest crews stay behind.</p>
        <form class="account-email" @submit.prevent="submitEmail">
          <input v-model="email" type="email" required placeholder="you@example.com" aria-label="Email" autocomplete="email" />
          <button type="submit" class="primary" :disabled="busy || !email.includes('@')">
            {{ mode === 'save' ? 'Save' : 'Send link' }}
          </button>
        </form>
        <button type="button" class="link-button" @click="mode = mode === 'save' ? 'signin' : 'save'">
          {{ mode === 'save' ? 'I already have an account' : 'Save this guest account instead' }}
        </button>
      </template>
      <template v-else>
        <h3 id="account-sync">Signed in</h3>
        <p class="muted-note">As {{ session.email }}. Sign in with the same email on any device.</p>
        <button type="button" class="ghost" @click="emit('signOut')">Sign out</button>
      </template>
    </section>
  </dialog>
</template>
