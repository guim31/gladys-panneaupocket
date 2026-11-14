# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-14

### Added

- Search the PanneauPocket emitters (town halls, groupings of communes, schools, gendarmerie units)
  by postcode, commune name or page address, and add them from the Discover tab.
- One device per emitter: current messages, current alerts and the latest message with its date.
- Scene trigger "new message", filterable by emitter and kind (information, alert, event), with the
  title, text, date, link and a one-sentence summary; nothing is announced for the messages already
  on display at the first start or when an emitter is added.
- Scene action "read the messages": the current messages as one sentence, with their count and the
  number of alerts.
- Dashboard widget with the messages, alerts first, the whole text one tap away.
- Feature names and texts in English, French, German and Spanish; documentation in the four
  languages.

[Unreleased]: https://github.com/guim31/gladys-panneaupocket/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-panneaupocket/releases/tag/v1.0.0
