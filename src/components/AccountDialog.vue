<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Person } from '../lib/overlap'
import type { Session } from '../lib/store'
import AppIcon from './AppIcon.vue'
import ProfileFields from './ProfileFields.vue'

/** You: name and avatar, saving a guest account by email, signing in elsewhere, signing out. */
const props = defineProps<{ open: boolean; session: Session; profile: Person | null; busy: boolean; google: boolean; taken?: readonly { name: string; emoji: string }[] }>()
const emit = defineEmits<{
  close: []
  profile: [name: string, emoji: string]
  save: [email: string]
  signIn: [email: string]
  google: [mode: 'save' | 'signin']
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
      <h2 id="account-title">Your profile</h2>
      <button type="button" class="ghost icon-only" aria-label="Close" @click="emit('close')"><AppIcon name="close" /></button>
    </div>

    <form v-if="profile" class="account-block" @submit.prevent="emit('profile', name, emoji)">
      <ProfileFields v-model:name="name" v-model:emoji="emoji" :taken="taken" />
      <button type="submit" class="primary" :disabled="busy || !name.trim() || !emoji.trim()">Save name and avatar</button>
    </form>

    <section class="account-block" aria-labelledby="account-sync">
      <template v-if="session.guest">
        <h3 id="account-sync">{{ mode === 'save' ? 'Save your account' : 'Sign in' }}</h3>
        <p v-if="mode === 'save'" class="muted-note">
          You're a guest on this device. Add your email to keep your crews if you clear the browser, and to sign in on your phone.
        </p>
        <p v-else class="muted-note">Already saved an account? Sign in with it. This device's guest crews stay behind.</p>
        <button v-if="google" type="button" class="google-button" :disabled="busy" @click="emit('google', mode)">
          <svg viewBox="0 0 18 18" aria-hidden="true" width="18" height="18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.96 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
          </svg>
          {{ mode === 'save' ? 'Save with Google' : 'Sign in with Google' }}
        </button>
        <p v-if="google" class="or-divider" aria-hidden="true">or with email</p>
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
        <p class="muted-note">As {{ session.email }}. Sign in the same way on any device.</p>
        <button type="button" class="ghost" @click="emit('signOut')">Sign out</button>
      </template>
    </section>
  </dialog>
</template>
