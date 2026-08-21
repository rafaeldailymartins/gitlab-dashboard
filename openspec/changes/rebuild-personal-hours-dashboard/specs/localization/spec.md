## Purpose

Presents every user-facing string, date and number in the reader's language, so
the dashboard reads naturally to both an English and a Brazilian Portuguese
speaker.

## ADDED Requirements

### Requirement: I18N-1 — The interface is available in English and Brazilian Portuguese

Every user-facing string SHALL exist in English and in Brazilian Portuguese.

#### Scenario: Reading the dashboard in Portuguese

- **WHEN** the active language is Brazilian Portuguese
- **THEN** every visible label, heading, button and message is in Brazilian
  Portuguese

#### Scenario: Reading the dashboard in English

- **WHEN** the active language is English
- **THEN** every visible label, heading, button and message is in English

### Requirement: I18N-2 — A first visit picks a language automatically

On a first visit the system SHALL select the language from the languages the
browser reports, falling back to English when none of them is supported.

#### Scenario: A browser preferring Brazilian Portuguese

- **WHEN** a person visits for the first time with a browser preferring
  Brazilian Portuguese
- **THEN** the interface is in Brazilian Portuguese without them choosing

#### Scenario: A browser preferring an unsupported language

- **WHEN** a person visits for the first time with a browser preferring a
  language the application does not offer
- **THEN** the interface is in English

### Requirement: I18N-3 — Changing the language is immediate and remembered

Choosing a language SHALL take effect without reloading and SHALL still apply on
a later visit.

#### Scenario: Switching language

- **WHEN** a person switches the language
- **THEN** the visible text changes without a page reload

#### Scenario: Returning after choosing a language

- **WHEN** a person who chose a language returns later
- **THEN** the interface is in the language they chose, regardless of what the
  browser reports

### Requirement: I18N-4 — Dates, weekdays and numbers follow the active language

Dates, weekday and month names, and numeric figures SHALL be formatted for the
active language, and dates SHALL be formatted in the configured time zone.

#### Scenario: A date in each language

- **WHEN** the same day is shown in English and then in Brazilian Portuguese
- **THEN** each uses that language's conventions for weekday, month and order

#### Scenario: Hours in each language

- **WHEN** a figure with a decimal part is shown in Brazilian Portuguese
- **THEN** it uses the decimal separator of that language

### Requirement: I18N-5 — No user-facing text is hardcoded

User-facing text SHALL come only from the translation catalogues, and a missing
translation SHALL fail the build rather than reach a reader.

#### Scenario: A missing translation

- **WHEN** a string exists in English but not in Brazilian Portuguese
- **THEN** the build fails and names the missing entry

#### Scenario: An untranslated literal in the interface

- **WHEN** a screen renders text that is not in the catalogues
- **THEN** it is treated as a defect, because no reader-facing literal is
  permitted in the interface

### Requirement: I18N-6 — The document declares its language

The page SHALL declare the active language to the browser and to assistive
technology.

#### Scenario: Assistive technology reads Portuguese content

- **WHEN** the active language is Brazilian Portuguese
- **THEN** the document's declared language is Brazilian Portuguese
