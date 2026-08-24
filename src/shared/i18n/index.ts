// Public i18n surface. Nothing outside this module imports from the generated
// `src/paraglide` output, so the message compiler stays an implementation
// detail we can reconfigure without touching call sites.
//
// The message compiler also owns which language is active — there is
// deliberately no second copy of that in the preferences store.

export { LocaleProvider, useActiveLocale } from './locale-provider'
export { m } from '@/paraglide/messages.js'
export { type Locale, locales } from '@/paraglide/runtime.js'
