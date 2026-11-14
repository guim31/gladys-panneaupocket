# PanneauPocket

Your town hall's messages in Gladys Assistant: alerts, news and events published on
[PanneauPocket](https://www.panneaupocket.com), the digital notice board of thousands of communes,
groupings of communes, schools and gendarmerie units in France. Be told as soon as a new message
appears, send it to the whole family, have it read aloud. No account, no key.

**Unofficial** integration: it reads the public pages of PanneauPocket, like a browser. Not
affiliated with PanneauPocket. Developed without an emitter account: feedback welcome.

## What you get

- **One device per followed emitter** (a town hall, a school, a gendarmerie unit…): number of
  current messages, number of current alerts, and the latest message with its date.
- A **scene trigger** "new message", filterable by emitter and by kind (information, alert, event),
  with the title, the text, the date and the link as scene variables.
- A **scene action** that reads the current messages as one sentence.
- A **dashboard widget** with the messages, alerts first, and the whole text one tap away.

Nothing is sent at the first start, nor when an emitter is added: the messages already on display
are not news.

## Requirements

- Gladys Assistant 5.3.0 or later.
- Internet access from Gladys to `app.panneaupocket.com`.
- Nothing else: the pages of the emitters are public.

## Configuration

### Settings

| Setting                      | Role                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Search the emitters          | Postcodes, commune names or PanneauPocket page addresses, separated by commas.              |
| Reading interval             | 15, 30 or 60 minutes; 30 by default. One page read per followed emitter each time.          |
| Language of the device texts | Feature names (at their creation), latest message and scene texts. The messages stay as is. |

Save, then open the **Discover** tab of the integration: every emitter found is offered there. Add
the ones you want to follow; only those are read.

### Finding your emitters

- **A postcode** (`89100`) offers every emitter of that code: the town hall, but also the
  gendarmerie, the school or the grouping of communes based there.
- **A commune name** (`Tigy`, `Saint-Denis-lès-Sens`) finds the commune and the emitters whose name
  holds these words (`Sens` finds "Gendarmerie COB de Sens"). Accents, hyphens and capitals do not
  matter.
- **The address of a page** (`https://app.panneaupocket.com/ville/1764110563-nailly-89100`), or its
  number alone, names one emitter.

Some communes publish several boards (one topic each): each is an emitter. A search offers 60
emitters at most; beyond that, narrow it. The device takes the emitter's name and postcode; you can
rename it in Gladys.

## Device

| Feature          | Type    | Value                                                               |
| ---------------- | ------- | ------------------------------------------------------------------- |
| Current messages | Counter | The messages shown on the emitter's page.                           |
| Current alerts   | Counter | Those of them the emitter marked "Alert".                           |
| Latest message   | Text    | The newest one, with its date, e.g. `12/11 · APPEL À LA VIGILANCE`. |

The latest message is the one with the most recent publication (or edit) date; an event without a
publication date counts from the day the integration saw it appear.

## Dashboard widget

**PanneauPocket**: up to 8 messages, alerts first then the newest, with a badge per kind (red for
an alert). Tap a row to read the whole text, with links to the page and to the message's picture.
Settings: one emitter (empty: all the ones you follow) and the button to the page, which you can
hide.

## Scene trigger

**PanneauPocket: new message.** A message appears on the page of a followed emitter. Filters: the
emitter (empty: all) and the kind of message (empty: all). An edited message does not fire it
again.

Variables: emitter (the name given in Gladys), kind of message, title, text (1000 characters at
most), date as written on the page ("Alerte publiée le 12/11/2026"), link to the page, and a
one-sentence summary ("Nailly (89100), alert: APPEL À LA VIGILANCE"). The title and the text are
the emitter's own, in French.

PanneauPocket sends no notice: the integration sees a message at the next reading of the page, so
within the reading interval you chose.

## Scene action

**PanneauPocket: read the messages.** Outputs: the current messages of an emitter as one sentence
(5 titles at most, alerts counted), their number and the number of alerts. With no emitter chosen:
all the ones you follow, emitter by emitter. The page is read again if its last reading is older
than one interval. If no page could be read, the action fails with a clear message.

## Scene examples

- **Tell the family**: trigger "new message", then the action "Send a message" to each chosen user,
  with `{{triggerEvent.data.summary}} {{triggerEvent.data.url}}`. This is how new messages reach the
  users you want: an integration cannot write to a Gladys user directly.
- **Town hall alert**: trigger "new message" with the kind "Alert", then have
  `{{triggerEvent.data.title}}` read aloud and make a lamp blink.
- **Morning briefing**: every day at 7:30, the action "read the messages", then send its text by
  message.

## Data sources, terms and load

PanneauPocket has no documented public API. The integration reads what anyone can read without an
account, introducing itself as `gladys-panneaupocket` (no browser imitation):

- the list of the emitters, the one the site's search uses (about 16,000 entries), read **once a
  day at most** and only when a search needs it, then kept under `/data`;
- the public page of every **added** emitter, once per interval (15 to 60 minutes), the pages read
  one after the other, a few seconds apart.

The messages belong to their emitters and to PanneauPocket; the integration shows them in your
home and republishes them nowhere. The site can change at any time and break the reading: an update
of the integration will then be needed.

## Troubleshooting

- **No device in the Discover tab**: type a postcode or a commune name, save, then open the
  Discover tab. The status of the integration says when a term finds nothing.
- **"The list of PanneauPocket emitters cannot be read"**: the site is unreachable; the search comes
  back as soon as it answers (tried again an hour later at the soonest). The emitters already added
  are still read.
- **"PanneauPocket does not answer for: …"**: the page of these emitters could not be read; the
  latest messages stay on display and the integration tries again at every interval.
- **"No longer on PanneauPocket: …"**: the emitter left PanneauPocket or changed page; delete the
  device and search for it again.
- **More details**: set `LOG_LEVEL=debug` in the integration and read its logs.

## Limits

- Unofficial: reading the pages depends on their current layout.
- A new message is seen within the reading interval, not to the second: for an urgent alert, the
  PanneauPocket app remains the reference.
- At most 10 new messages announced per page and per reading: an emitter publishing more at once
  only gets its 10 oldest announced; the device and the widget show them all.
- The messages are in French, as the emitters write them; pictures are only given by their link.
- Only the emitters of the site's public list are found; today it only holds French emitters.
- The integration keeps the messages already seen under `/data`: if this volume is lost, the
  messages in place are taken as known, without announcing anything.
- Not affiliated with PanneauPocket.
