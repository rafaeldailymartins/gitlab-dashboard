import { usePreferences, withTimeZone } from '@/entities/preferences'
import { m } from '@/shared/i18n'
import { SelectField } from '@/shared/ui/select-field'

/**
 * Every zone the runtime knows about, so there is no list to keep up to date as
 * the IANA database changes. `Intl.supportedValuesOf` has been available in
 * every browser this app targets since 2022, so there is no fallback list to
 * drift out of date either.
 */
const TIME_ZONES = Intl.supportedValuesOf('timeZone')

export function TimeZoneField() {
  const { preferences, setPreferences } = usePreferences()

  return (
    <SelectField
      description={m.time_zone_description()}
      label={m.time_zone_label()}
      onChange={(zone) => {
        setPreferences(withTimeZone(preferences, zone))
      }}
      options={TIME_ZONES.map((zone) => ({ label: zone.replaceAll('_', ' '), value: zone }))}
      value={preferences.timeZone}
    />
  )
}
