# PanneauPocket for Gladys Assistant

The messages of French town halls, groupings of communes, schools and gendarmerie units published on
[PanneauPocket](https://www.panneaupocket.com), in [Gladys Assistant](https://gladysassistant.com):
one device per followed emitter, a scene trigger for every new message, a scene action and a
dashboard widget. No account, no key.

**Unofficial**: PanneauPocket has no public API, the integration reads its public pages. Not
affiliated with PanneauPocket. Developed without an emitter account: feedback welcome.

## Features

- Search the emitters by postcode, commune name or page address; add the ones to follow from the
  Discover tab.
- One device per emitter: current messages, current alerts, latest message with its date.
- Scene trigger `new_message`, filterable by emitter and kind (information, alert, event), with the
  title, text, date, link and a summary as variables: send new messages to the users you choose
  with the core's "Send a message" action.
- Scene action `read_messages`: the current messages as one sentence, to send or read aloud.
- Dashboard widget `messages`: alerts first, the whole text in the detail panel.
- Nothing announced at the first start nor when an emitter is added: no burst with the history.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Internet access to `app.panneaupocket.com`.

## Installation

In Gladys: **Integrations → Install from GitHub**, address `https://github.com/guim31/gladys-panneaupocket`.
Then type a postcode or a commune in the configuration, save, and add your emitters from the
**Discover** tab. The user documentation is in [docs/](docs/fr.md) (French, English, German,
Spanish).

## How it works

- The list of the emitters (`/public-api/city`, the JSON the site's own search uses, about 16,000
  entries) is read at most once a day, only when a search needs it, and kept under `/data`.
- The public page of each **added** emitter (`/ville/<id>-<slug>`) is read every 15, 30 or 60
  minutes (30 by default), one page after the other, a few seconds apart. The site loads no JSON for
  the messages: they are parsed from the HTML (`data-id`, kind icon, date line, title, text).
- A message id seen for the first time fires `new_message`; the first reading of an emitter only
  records what is there. The ids seen are kept under `/data/panneaupocket.json`.
- Requests carry an honest User-Agent (`gladys-panneaupocket`), no browser imitation.

## Limitations

- The page layout can change at any time and break the reading: an update will then be needed.
- A new message is seen within the reading interval; the PanneauPocket app stays the reference for
  urgent alerts.
- At most 10 new messages announced per page and per reading, plus every alert.
- The messages are in French; pictures are given by their link only.
- Only the emitters of the site's public list (French today) can be followed.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and a fake PanneauPocket serving real pages and an
excerpt of the list recorded on 14/11/2026 (`test/fixtures/panneaupocket/`, e-mail addresses and
phone numbers replaced): never the network.

## Credits

- Messages: their emitters, published on [PanneauPocket](https://www.panneaupocket.com).
- Cover: the official PanneauPocket logo, taken from the site
  (`app.panneaupocket.com/build/images/logo/`); a trademark of its owner.
- Built on the [Gladys integration SDK](https://github.com/GladysAssistant/integration-sdk-js) and
  the official JavaScript template.

## License

[Apache 2.0](LICENSE).
