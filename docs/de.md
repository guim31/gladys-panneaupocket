# PanneauPocket

Die Meldungen deines Rathauses in Gladys Assistant: Warnungen, Informationen und Veranstaltungen,
veröffentlicht auf [PanneauPocket](https://www.panneaupocket.com), dem digitalen Aushang tausender
Gemeinden, Gemeindeverbände, Schulen und Gendarmerien in Frankreich. Erfahre sofort, wenn eine neue
Meldung erscheint, schick sie der ganzen Familie, lass sie vorlesen. Kein Konto, kein Schlüssel.

**Inoffizielle** Integration: Gelesen werden die öffentlichen Seiten von PanneauPocket, wie in einem
Browser.
Nicht mit PanneauPocket verbunden. Ohne Absenderkonto entwickelt: Feedback willkommen.

## Was du bekommst

- **Ein Gerät pro verfolgtem Absender** (ein Rathaus, eine Schule, eine Gendarmerie…): Anzahl der
  aktuellen Meldungen, Anzahl der aktuellen Warnungen und die neueste Meldung mit ihrem Datum.
- Ein **Szenen-Auslöser** „neue Meldung“, filterbar nach Absender und Art (Information, Warnung,
  Veranstaltung), mit Titel, Text, Datum und Link als Szenenvariablen.
- Eine **Szenen-Aktion**, die die aktuellen Meldungen als einen Satz liest.
- Ein **Dashboard-Widget** mit den Meldungen, Warnungen zuerst, und dem ganzen Text mit einem
  Tippen.

Beim ersten Start und beim Hinzufügen eines Absenders wird nichts gesendet: Die bereits
angezeigten Meldungen sind keine Neuigkeiten.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer.
- Internetzugang von Gladys zu `app.panneaupocket.com`.
- Sonst nichts: Die Seiten der Absender sind öffentlich.

## Konfiguration

### Einstellungen

| Einstellung             | Zweck                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Absender suchen         | Postleitzahlen, Gemeindenamen oder Adressen von PanneauPocket-Seiten, durch Kommas getrennt.                       |
| Leseintervall           | 15, 30 oder 60 Minuten; standardmäßig 30. Jedes Mal eine Seite pro verfolgtem Absender.                            |
| Sprache der Gerätetexte | Namen der Funktionen (bei ihrer Erstellung), neueste Meldung und Szenentexte. Die Meldungen bleiben, wie sie sind. |

Speichere und öffne dann den Tab **Entdecken** der Integration: Dort wird jeder gefundene Absender
angeboten. Füge die hinzu, denen du folgen willst; nur diese werden gelesen.

### Deine Absender finden

- **Eine Postleitzahl** (`89100`) bietet alle Absender dieser Postleitzahl an: das Rathaus, aber
  auch die Gendarmerie, die Schule oder den Gemeindeverband mit Sitz dort.
- **Ein Gemeindename** (`Tigy`, `Saint-Denis-lès-Sens`) findet die Gemeinde und die Absender, deren
  Name diese Wörter enthält (`Sens` findet „Gendarmerie COB de Sens“). Akzente, Bindestriche und
  Großschreibung spielen keine Rolle.
- **Die Adresse einer Seite** (`https://app.panneaupocket.com/ville/1764110563-nailly-89100`) oder
  nur ihre Nummer bezeichnet einen bestimmten Absender.

Manche Gemeinden veröffentlichen mehrere Aushänge (je ein Thema): Jeder ist ein Absender. Eine Suche
bietet höchstens 60 Absender an; darüber hinaus grenze sie ein. Das Gerät bekommt den Namen des
Absenders und seine Postleitzahl; du kannst es in Gladys umbenennen.

## Gerät

| Funktion           | Typ    | Wert                                                                 |
| ------------------ | ------ | -------------------------------------------------------------------- |
| Aktuelle Meldungen | Zähler | Die auf der Seite des Absenders angezeigten Meldungen.               |
| Aktuelle Warnungen | Zähler | Die davon, die der Absender als „Alerte“ markiert hat.               |
| Neueste Meldung    | Text   | Die neueste, mit ihrem Datum, z. B. `12.11. · APPEL À LA VIGILANCE`. |

Die neueste Meldung ist die mit dem jüngsten Veröffentlichungs- (oder Änderungs-)Datum; eine
Veranstaltung ohne Veröffentlichungsdatum zählt ab dem Tag, an dem die Integration sie erscheinen sah, und die beim Hinzufügen des Absenders bereits angezeigten, ohne Datum, kommen zuletzt.

## Dashboard-Widget

**PanneauPocket**: bis zu 8 Meldungen, Warnungen zuerst, dann die neuesten, mit einem Abzeichen pro
Art (rot für eine Warnung). Tippe auf eine Zeile, um den ganzen Text zu lesen, mit Links zur Seite
und zum Bild der Meldung. Einstellungen: ein Absender (leer: alle, denen du folgst) und die
Schaltfläche zur Seite, die du ausblenden kannst.

## Szenen-Auslöser

**PanneauPocket: neue Meldung.** Eine Meldung erscheint auf der Seite eines verfolgten Absenders.
Filter: der Absender (leer: alle) und die Art der Meldung (leer: alle). Eine geänderte Meldung löst
ihn nicht erneut aus.

Variablen: Absender (der in Gladys vergebene Name), Art der Meldung, Titel, Text (höchstens 1000
Zeichen), Datum wie auf der Seite geschrieben („Alerte publiée le 12/11/2026“), Link zur Seite und
eine Zusammenfassung in einem Satz („Nailly (89100), Warnung: APPEL À LA VIGILANCE“). Titel und
Text sind die des Absenders, auf Französisch.

PanneauPocket benachrichtigt nicht: Die Integration sieht eine Meldung beim nächsten Lesen der
Seite, also innerhalb des gewählten Leseintervalls.

## Szenen-Aktion

**PanneauPocket: Meldungen lesen.** Ausgaben: die aktuellen Meldungen eines Absenders als ein Satz
(höchstens 5 Titel, Warnungen gezählt), ihre Anzahl und die Anzahl der Warnungen. Ohne gewählten
Absender: alle, denen du folgst, Absender für Absender. Die Seite wird neu gelesen, wenn ihr letztes
Lesen länger als ein Intervall zurückliegt. Konnte keine Seite gelesen werden, schlägt die Aktion
mit einer klaren Meldung fehl.

## Szenenbeispiele

- **Die Familie informieren**: Auslöser „neue Meldung“, dann die Aktion „Nachricht senden“ an jeden
  gewünschten Benutzer, mit `{{triggerEvent.data.summary}} {{triggerEvent.data.url}}`. So erreichen
  neue Meldungen die gewünschten Benutzer: Eine Integration kann einem Gladys-Benutzer nicht direkt
  schreiben.
- **Warnung des Rathauses**: Auslöser „neue Meldung“ mit der Art „Warnung“, dann
  `{{triggerEvent.data.title}}` vorlesen lassen und eine Lampe blinken lassen.
- **Der Morgenüberblick**: jeden Tag um 7:30 Uhr die Aktion „Meldungen lesen“, dann ihren Text als
  Nachricht senden.

## Datenquellen, Bedingungen und Last

PanneauPocket hat keine dokumentierte öffentliche API. Die Integration liest, was jeder ohne Konto
lesen kann, und stellt sich als `gladys-panneaupocket` vor (keine Browser-Imitation):

- die Liste der Absender, die die Suche der Website verwendet (etwa 16.000 Einträge), **höchstens
  einmal am Tag** und nur, wenn eine Suche sie braucht, gelesen und dann unter `/data` gespeichert;
- die öffentliche Seite jedes **hinzugefügten** Absenders, einmal pro Intervall (15 bis 60
  Minuten), die Seiten nacheinander, im Abstand von einigen Sekunden.

Die Meldungen gehören ihren Absendern und PanneauPocket; die Integration zeigt sie bei dir zu Hause
an und veröffentlicht sie nirgends erneut. Die Website kann sich jederzeit ändern und das Lesen
verhindern: Dann ist ein Update der Integration nötig.

## Fehlerbehebung

- **Kein Gerät im Tab „Entdecken“**: Gib eine Postleitzahl oder einen Gemeindenamen ein, speichere
  und öffne dann den Tab „Entdecken“. Der Status der Integration sagt, wenn ein Begriff nichts
  findet.
- **„Die Liste der PanneauPocket-Absender ist nicht lesbar“**: Die Website ist nicht erreichbar; die
  Suche kommt zurück, sobald sie antwortet (neuer Versuch frühestens eine Stunde später). Die bereits
  hinzugefügten Absender werden weiter gelesen.
- **„PanneauPocket antwortet nicht für: …“**: Die Seite dieser Absender konnte nicht gelesen werden;
  die letzten Meldungen bleiben angezeigt und die Integration versucht es bei jedem Intervall
  erneut.
- **„Nicht mehr auf PanneauPocket: …“**: Der Absender hat PanneauPocket verlassen oder die Seite
  gewechselt; lösche das Gerät und suche ihn erneut.
- **Mehr Details**: Setze `LOG_LEVEL=debug` in der Integration und lies ihre Protokolle.

## Grenzen

- Inoffiziell: Das Lesen der Seiten hängt von ihrem aktuellen Aufbau ab.
- Eine neue Meldung wird innerhalb des Leseintervalls gesehen, nicht auf die Sekunde: Für eine
  dringende Warnung bleibt die PanneauPocket-App die Referenz.
- Höchstens 10 neue Meldungen pro Seite und Lesen werden angekündigt: Ein Absender, der mehr auf
  einmal veröffentlicht, bekommt nur die 10 ältesten angekündigt, dazu alle Warnungen; Gerät und Widget zeigen alle.
- Die Meldungen sind auf Französisch, wie die Absender sie schreiben; Bilder werden nur als Link
  angegeben.
- Nur die Absender der öffentlichen Liste der Website werden gefunden; sie enthält heute nur
  französische Absender.
- Die Integration speichert die bereits gesehenen Meldungen unter `/data`: Geht dieses Volume
  verloren, werden die vorhandenen Meldungen als bekannt übernommen, ohne etwas anzukündigen.
- Nicht mit PanneauPocket verbunden.
