# PanneauPocket

Les messages de votre mairie dans Gladys Assistant : alertes, informations et événements publiés
sur [PanneauPocket](https://www.panneaupocket.com), le panneau d'affichage numérique de milliers de
communes, intercommunalités, écoles et gendarmeries en France. Soyez prévenu dès qu'un nouveau
message paraît, envoyez-le à toute la famille, faites-le lire à voix haute. Pas de compte, pas de
clé.

Intégration **non officielle** : elle lit les pages publiques de PanneauPocket, comme un
navigateur. Non affilié à PanneauPocket. Développée sans compte émetteur : vos retours sont
bienvenus.

## Ce que vous obtenez

- **Un appareil par émetteur suivi** (une mairie, une école, une gendarmerie…) : nombre de
  messages en cours, nombre d'alertes en cours, et le dernier message avec sa date.
- Un **déclencheur de scène** « nouveau message », filtrable par émetteur et par type (information,
  alerte, événement), avec le titre, le texte, la date et le lien en variables de scène.
- Une **action de scène** qui lit les messages en cours en une phrase.
- Un **widget de tableau de bord** avec les messages, alertes d'abord, et le texte complet d'un
  simple toucher.

Rien n'est envoyé au premier démarrage, ni à l'ajout d'un émetteur : les messages déjà affichés ne
sont pas des nouveautés.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Un accès Internet de Gladys vers `app.panneaupocket.com`.
- Rien d'autre : les pages des émetteurs sont publiques.

## Configuration

### Réglages

| Réglage                         | Rôle                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Rechercher les émetteurs        | Codes postaux, noms de communes ou adresses de pages PanneauPocket, séparés par des virgules.                      |
| Intervalle de lecture           | 15, 30 ou 60 minutes ; 30 par défaut. Une page lue par émetteur suivi à chaque fois.                               |
| Langue des textes des appareils | Noms des fonctionnalités (à leur création), dernier message et textes des scènes. Les messages restent tels quels. |

Enregistrez, puis ouvrez l'onglet **Découverte** de l'intégration : chaque émetteur trouvé y est
proposé. Ajoutez ceux que vous voulez suivre ; seuls ceux-là sont lus.

### Trouver ses émetteurs

- **Un code postal** (`89100`) propose tous les émetteurs de ce code : la mairie, mais aussi la
  gendarmerie, l'école ou l'intercommunalité qui y ont leur adresse.
- **Un nom de commune** (`Tigy`, `Saint-Denis-lès-Sens`) trouve la commune et les émetteurs dont le
  nom contient ces mots (`Sens` trouve « Gendarmerie COB de Sens »). Accents, tirets et majuscules
  sont indifférents.
- **L'adresse d'une page** (`https://app.panneaupocket.com/ville/1764110563-nailly-89100`), ou son
  numéro seul, désigne un émetteur précis.

Certaines communes publient plusieurs panneaux (une rubrique par thème) : ce sont autant
d'émetteurs. Une recherche propose 60 émetteurs au plus ; au-delà, précisez-la. L'appareil prend le
nom de l'émetteur et son code postal ; vous pouvez le renommer dans Gladys.

## Appareil

| Fonctionnalité    | Type     | Valeur                                                            |
| ----------------- | -------- | ----------------------------------------------------------------- |
| Messages en cours | Compteur | Les messages affichés sur la page de l'émetteur.                  |
| Alertes en cours  | Compteur | Ceux d'entre eux marqués « Alerte » par l'émetteur.               |
| Dernier message   | Texte    | Le plus récent, avec sa date, ex. `12/11 · APPEL À LA VIGILANCE`. |

Le dernier message est celui dont la date de publication (ou de modification) est la plus
récente ; un événement sans date de publication compte du jour où l'intégration l'a vu paraître.

## Widget de tableau de bord

**PanneauPocket** : jusqu'à 8 messages, les alertes d'abord puis les plus récents, avec une
pastille par type (rouge pour une alerte). Touchez une ligne pour lire le texte complet, avec les
liens vers la page et vers l'image du message. Réglages : un émetteur (vide : tous ceux que vous
suivez) et le bouton vers la page, que vous pouvez masquer.

## Déclencheur de scène

**PanneauPocket : nouveau message.** Un message paraît sur la page d'un émetteur suivi. Filtres :
l'émetteur (vide : tous) et le type de message (vide : tous). Un message modifié ne le déclenche
pas de nouveau.

Variables : émetteur (le nom donné dans Gladys), type de message, titre, texte (1000 caractères au
plus), date telle qu'écrite sur la page (« Alerte publiée le 12/11/2026 »), lien de la page, et un
résumé en une phrase (« Nailly (89100), alerte : APPEL À LA VIGILANCE »). Le titre et le texte sont
ceux de l'émetteur.

PanneauPocket ne prévient pas : l'intégration voit un message à la lecture suivante de la page,
donc dans l'intervalle de lecture choisi.

## Action de scène

**PanneauPocket : lire les messages.** Sorties : les messages en cours d'un émetteur en une phrase
(5 titres au plus, alertes comptées), leur nombre et le nombre d'alertes. Sans émetteur choisi :
tous ceux que vous suivez, émetteur par émetteur. La page est relue si sa dernière lecture date de
plus d'un intervalle. Si aucune page n'a pu être lue, l'action échoue avec un message clair.

## Exemples de scènes

- **Prévenir la famille** : déclencheur « nouveau message », puis l'action « Envoyer un message » à
  chaque utilisateur choisi, avec `{{triggerEvent.data.summary}} {{triggerEvent.data.url}}`. C'est
  ainsi que les nouveaux messages vont aux utilisateurs voulus : une intégration ne peut pas écrire
  directement à un utilisateur de Gladys.
- **Alerte de la mairie** : déclencheur « nouveau message » avec le type « Alerte », puis faire
  lire `{{triggerEvent.data.title}}` à voix haute et faire clignoter une lampe.
- **Le point du matin** : chaque jour à 7 h 30, l'action « lire les messages », puis envoyer son
  texte par message.

## Sources, conditions et charge

PanneauPocket n'a pas d'API publique documentée. L'intégration lit ce que tout le monde peut lire
sans compte, en se présentant comme `gladys-panneaupocket` (pas d'imitation de navigateur) :

- la liste des émetteurs, celle qu'utilise la recherche du site (environ 16 000 entrées), lue
  **une fois par jour au plus** et seulement quand une recherche en a besoin, puis gardée sous
  `/data` ;
- la page publique de chaque émetteur **ajouté**, une fois par intervalle (15 à 60 minutes), les
  pages lues l'une après l'autre, à quelques secondes d'écart.

Les messages appartiennent à leurs émetteurs et à PanneauPocket ; l'intégration les affiche chez
vous et ne les republie nulle part. Le site peut changer à tout moment et casser la lecture : une
mise à jour de l'intégration sera alors nécessaire.

## Dépannage

- **Aucun appareil dans l'onglet Découverte** : saisissez un code postal ou un nom de commune,
  enregistrez, puis ouvrez l'onglet Découverte. Le statut de l'intégration dit quand un terme ne
  trouve rien.
- **« La liste des émetteurs PanneauPocket est illisible »** : le site est injoignable ; la
  recherche revient dès qu'il répond (nouvel essai une heure plus tard au plus tôt). Les émetteurs
  déjà ajoutés continuent d'être lus.
- **« PanneauPocket ne répond pas pour : … »** : la page de ces émetteurs n'a pas pu être lue ; les
  derniers messages restent affichés et l'intégration réessaie à chaque intervalle.
- **« N'est plus sur PanneauPocket : … »** : l'émetteur a quitté PanneauPocket ou changé de page ;
  supprimez l'appareil, et cherchez-le de nouveau.
- **Plus de détails** : réglez `LOG_LEVEL=debug` dans l'intégration et lisez ses logs.

## Limites

- Non officiel : la lecture des pages dépend de leur présentation actuelle.
- Un nouveau message est vu dans l'intervalle de lecture, pas à la seconde : pour une alerte
  urgente, l'application PanneauPocket reste la référence.
- Au plus 10 nouveaux messages annoncés par page et par lecture : un émetteur qui publie d'un coup
  plus que cela n'en annonce que les 10 plus anciens ; l'appareil et le widget les montrent tous.
- Les messages sont en français, tels que les émetteurs les écrivent ; les images ne sont données
  que par leur lien.
- Seuls les émetteurs de la liste publique du site sont trouvés ; elle ne compte aujourd'hui que
  des émetteurs français.
- L'intégration retient sous `/data` les messages déjà vus : si ce volume est perdu, les messages
  en place sont repris comme connus, sans rien annoncer.
- Non affilié à PanneauPocket.
