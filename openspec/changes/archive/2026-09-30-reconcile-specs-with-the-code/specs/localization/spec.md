## MODIFIED Requirements

### Requirement: I18N-5 — No user-facing text is hardcoded

User-facing text SHALL come only from the translation catalogues, and a missing
translation SHALL fail verification rather than reach a reader.

#### Scenario: A missing translation

- **WHEN** a string exists in English but not in Brazilian Portuguese
- **THEN** verification fails and names the missing entry, before anything ships

#### Scenario: An untranslated literal in the interface

- **WHEN** a screen renders text that is not in the catalogues
- **THEN** it is treated as a defect, because no reader-facing literal is
  permitted in the interface
