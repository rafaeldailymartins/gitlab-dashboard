import { type Locale, locales, m, useActiveLocale } from '@/shared/i18n'
import { SelectField } from '@/shared/ui/select-field'

/**
 * Each language is named in itself, so a reader can find their own. Keyed by
 * `Locale` rather than `string`, so adding a language without naming it is a
 * compile error instead of a silent fall back to its tag.
 */
const LANGUAGE_LABELS: Record<Locale, () => string> = {
  en: m.language_en,
  'pt-BR': m.language_pt_br,
}

export function LocaleField() {
  const { changeLocale, locale } = useActiveLocale()

  return (
    <SelectField<Locale>
      label={m.language_label()}
      onChange={changeLocale}
      options={locales.map((candidate) => ({
        label: LANGUAGE_LABELS[candidate](),
        value: candidate,
      }))}
      value={locale}
    />
  )
}
