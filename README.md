# Planraum – Uni- und Privatplaner

React/TypeScript mit Vite, FullCalendar und zwei Speichermöglichkeiten: lokal mit Express/SQLite oder online mit Supabase/PostgreSQL und Anmeldung. Die Anwendung verwendet echte gespeicherte Daten und startet ohne Beispieldaten.

## Lokal starten

Voraussetzung: Node.js ab 22.12 inklusive npm (z. B. der aktuelle Node.js-LTS-Installer von https://nodejs.org). Node wurde für die Entwicklung nur temporär heruntergeladen; damit ist es noch nicht dauerhaft auf dem Mac installiert.

```bash
npm ci
npm run dev
```

Öffne http://localhost:5173. Die API läuft ausschließlich auf dem lokalen Gerät auf Port 3001. `planraum.sqlite` entsteht beim ersten API-Start. `.env` ohne Supabase-Werte bedeutet SQLite-Betrieb.

```bash
npm run typecheck
npm test
npm run build
```

Für die Vorschau eines Builds: `npm start` für die API und in einem zweiten Terminal `npm run preview`. Der Vite-Preview-Server leitet `/api` ebenfalls an die lokale API weiter.

## Online mit GitHub Pages und Supabase

GitHub Pages stellt das gebaute Frontend bereit. Die Daten werden dann in Supabase gespeichert; SQLite/Express läuft nicht auf GitHub Pages. Supabase ersetzt im Onlinebetrieb das lokale Backend. Der GitHub-Pages-Code ist öffentlich zugänglich; persönliche Datensätze sind durch Anmeldung und Row Level Security getrennt.

1. Erstelle ein kostenloses Supabase-Projekt und führe `supabase/schema.sql` einmal im SQL Editor auf einer neuen Datenbank aus. Das Skript enthält Tabellen, Fremdschlüssel, benutzerspezifische RLS-Regeln und einen transaktionalen Backup-Import. Beim erneuten Ausführen existieren Policies und Trigger bereits; es ist ein initiales Setup, kein Migrationswerkzeug.
2. Aktiviere E-Mail/Passwort-Anmeldung. Lege die spätere GitHub-Pages-Adresse unter Authentication → URL Configuration als Site URL und erlaubte Redirect URL fest. Erstelle ein Konto in der App und bestätige deine E-Mail, falls aktiviert.
3. Setze im GitHub-Repository unter Settings → Secrets and variables → Actions → Variables die Repository-Variablen `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` (Supabase-Publishable-Key oder Legacy-anon-Key). Diese Werte sind für den Browser bestimmt. Ein `service_role`- oder Secret-Key gehört niemals in das Frontend.
4. Wähle unter Settings → Pages als Build-Quelle **GitHub Actions**. Der Workflow `.github/workflows/pages.yml` prüft die Konfiguration, führt die Tests aus, baut das Frontend und veröffentlicht es bei Änderungen an `main`.
5. Die erwartete Adresse für dieses Repository ist https://rebekkagantioler.github.io/ToDo-List/. Sie ist erst nach erfolgreicher Deployment-Ausführung aktiv.

Um den Supabase-Modus lokal auszuprobieren, kopiere `.env.example` nach `.env`, trage beide Werte ein und starte Vite neu. SQLite-Daten werden nicht automatisch hochgeladen: exportiere zunächst im lokalen Modus JSON und importiere die Sicherung nach Anmeldung im Supabase-Modus. Ein Import ersetzt sämtliche Daten des angemeldeten Kontos. Fehler rollen den Import vollständig zurück.

Es wurde noch kein echtes Supabase-Projekt verbunden und kein Live-Deployment verifiziert. Das SQL-Schema wurde mit einer lokalen PostgreSQL-Engine geprüft, einschließlich RLS zwischen zwei Testbenutzern und fehlerhaftem Import. Die echte Supabase-Auth-/E-Mail-Konfiguration muss mit dem Projekt geprüft werden.

## Implementiert

- Aufgaben und Kurse erstellen, bearbeiten und löschen; Aufgaben abschließen und wieder öffnen.
- Kombinierbare Filter nach Status, Bereich, Kurs, Aufgabenart und spätestem Deadline-Datum; Sortierung nach Deadline, Priorität, Aufwand, Kurs, Aufgabenart, Status und Titel.
- Kursdetailseite mit kursbezogenen Aufgaben, geplanten/vergangenen Einheiten, Zeiteinträgen und ECTS-Vergleich.
- Tages-/Wochenkalender, Aufgaben hineinziehen, Blöcke verschieben und verlängern/verkürzen, anklicken zum Bearbeiten/Löschen und einstellbare sichtbare Uhrzeiten.
- Aufgaben und Kalenderblöcke sind getrennt: Ein gelöschter Block löscht keine Aufgabe.
- Timer starten, pausieren, fortsetzen, speichern und verwerfen. Laufzeit und Pausen werden aus persistenten Zeitstempeln berechnet; Seitenwechsel und Neuladen erhalten den Timer. Aktive Timer blockieren weitere Starts in derselben App; Änderungen werden zwischen Browser-Tabs synchronisiert. Supabase-Konten haben getrennte lokale Timerzustände.
- Manuelle Arbeitszeiten hinzufügen, bearbeiten und löschen.
- Tatsächliche Arbeitszeit zählt nur aus Zeiteinträgen, niemals zusätzlich aus geplanten Blöcken. ECTS = ECTS × Stunden pro ECTS; der Wert wird als Orientierung dargestellt.
- Dashboard mit heutigen Aufgaben, Deadlines, kommenden Einheiten und tatsächlich innerhalb der aktuellen Woche erfasster Zeit.
- Heller/dunkler Modus mit lokaler Speicherung, mobile Navigation und vollständiger JSON-Datenexport/-import einschließlich vorhandener Wiederholungen und Einstellungen.

## Noch offen aus dem vollständigen Auftrag

Dieses Projekt ist ein funktionsfähiges Grundsystem, noch nicht die vollständige Umsetzung aller Anforderungen.

- Wiederkehrende Vorlesungen/Übungen: Tabellen und lokale Anlege-/Lösch-API vorhanden; Oberfläche, Kalenderdarstellung, Ausnahmen, Anwesenheitsbestätigung und automatische, einmalige Zeitverbuchung fehlen. Lehrveranstaltungszeit kann bisher manuell als Zeiteintrag an einer Aufgabe erfasst werden.
- Semester sind bisher Kursfelder; separate Semesterverwaltung, Semesterfilter und vollständige wöchentliche/Kurs-Zeitverteilung fehlen.
- ECTS-Auswertung zeigt noch keine eigene Summe zukünftiger Planung; automatische Vorlesungszeiten sind nicht implementiert.
- Deadline ohne Uhrzeit braucht noch eine eigene Auswahl; derzeit verwendet der Aufgabendialog Datum und Uhrzeit.
- Timer läuft lokal pro Browser. Ein serverseitiger, geräteübergreifender Timer-Lock und atomare Starts über mehrere Tabs fehlen noch. Pausen werden als Gesamtdauer gespeichert, nicht als einzelne Fokusintervalle; bei sehr langen Timern über Wochenwechsel kann die Wochenzuordnung entsprechend abweichen.
- Kalender-Uhrzeiten und Design werden bisher browserlokal gespeichert bzw. nur für die aktuelle Kalenderansicht gesetzt; zentrale Kontoeinstellungen fehlen.
- Tailwind CSS aus dem ursprünglichen Auftrag ist nicht eingerichtet; das vorhandene responsive CSS wurde beibehalten.
- Browserprüfung von Drag-and-drop, Touch-Bedienung, Responsivität sowie echte Supabase-Anmeldung/Deployment stehen noch aus.

## Tests

`tests/api.test.ts` startet eine echte API mit einer separaten temporären SQLite-Datenbank und prüft deaktivierte Zeiterfassung, null Minuten Aufwand, ungültige Intervalle, Fremdschlüssel, unabhängiges Löschen von Blöcken, vollständigen Backup-Import, Rollback und Löschbeziehungen. Persönliche Daten werden dabei nicht verwendet.

`tests/supabase.test.ts` prüft das SQL-Schema mit PGlite/PostgreSQL: RLS für zwei Benutzer, Verhinderung fremder Kursbeziehungen, atomaren Import und Kurslöschung ohne Verlust der Aufgaben. Supabase-Dienste selbst werden dabei nicht simuliert.

## Anmeldung, Registrierung und geteilte Kurse

Die App unterstützt Registrierung und Anmeldung mit Benutzername und Passwort. Benutzernamen bestehen aus 3–30 Buchstaben (a–z), Zahlen, Bindestrichen oder Unterstrichen; Groß-/Kleinschreibung wird nicht unterschieden. Supabase erhält intern eine technische Adresse unter `accounts.planraum.invalid`. Es wird keine echte E-Mail-Adresse benötigt. Aktiviere in Supabase Authentication „Allow new users to sign up“ und deaktiviere „Confirm Email“. Sonst funktioniert die Registrierung ohne E-Mail nicht. Eine Wiederherstellung per E-Mail ist für diese Konten nicht möglich. Die optionalen Variablen `VITE_LOGIN_USERNAME` und `VITE_LOGIN_EMAIL` erhalten die bisherige Anmeldung mit persönlichem Benutzernamen; neue Konten verwenden ihren Benutzernamen. Bestehende Konten aus der früheren E-Mail-Registrierung können sich weiterhin mit ihrer E-Mail-Adresse anmelden.

Führe auf bestehenden Projekten die aktuelle Datei `supabase/course-templates.sql` im SQL Editor aus (auch erneut, falls eine frühere Fassung bereits eingerichtet ist). Unter „Kurse → Kurs anlegen“ öffnet sich direkt der durchsuchbare Kurskatalog. Er enthält automatisch alle vorhandenen Kurse aller angemeldeten Nutzer, einschließlich älterer Kurse. Die Suche berücksichtigt Name, Kürzel und Semester; identische Katalogeinträge werden zusammengefasst. „Eigenen Kurs anlegen“ öffnet das Formular für einen neuen Kurs.

Der Katalog wird direkt aus den aktuellen Kurs- und Termindaten gelesen. Die SQL-Funktion gibt ausschließlich Kursname, Kürzel, Semester, ECTS, Richtwert, Farbe und Terminserien einschließlich Ausfällen aus. Persönliche Beschreibungen, Benutzerkennungen, Aufgaben, Arbeitszeiten, geplante Lernblöcke und andere Einstellungen werden nicht ausgegeben. Der Katalog erfordert Anmeldung; die privaten Tabellen behalten ihre RLS-Regeln. Eine Übernahme erstellt transaktional eine unabhängige Kopie. Spätere Änderungen wirken sich auf den Katalog, jedoch nicht auf bestehende Kopien aus. Im lokalen Modus enthält der Katalog die auf diesem Gerät angelegten Kurse.

## Hausaufgaben und Meldungen

Neue Hausaufgaben erhalten als veränderbare Deadline den Beginn der nächsten nicht ausgefallenen Kurseinheit. Unter Kursdetails → „Wöchentliche Hausaufgaben“ kann eine Vorlage an eine konkrete Terminserie gebunden werden. Jede Aufgabe erscheint sieben Kalendertage vor der zugehörigen Einheit. Optional lässt sich ein Name mit Startnummer festlegen, etwa „Blatt“ ab 4 für „Blatt 4“, „Blatt 5“ usw. Ausgefallene Einheiten zählen nicht mit; ein ausdrücklich gelöschtes Einzelblatt behält seinen Platz in der Nummernfolge. Über den Stift können Name und Nummerierung bestehender Serien für offene Blätter ab einem gewählten Datum angepasst werden; erledigte Aufgaben bleiben erhalten. Der Dialog zeigt die erste tatsächliche Abgabe und das Erscheinungsdatum als Vorschau. Die App ergänzt beim Laden und während geöffneter Nutzung jede Minute die fälligen Aufgaben; bei geschlossener App entstehen sie beim nächsten Öffnen. Stabile IDs verhindern doppelte Blätter, auch bei parallelen Browser-Tabs. Die Vorlagen werden in den vorhandenen Kontoeinstellungen gespeichert und sind im Backup enthalten.

Ein gelöschtes Blatt bleibt für diese Serie gelöscht. „Serie beenden“ verhindert weitere Aufgaben und erhält bestehende. Der Papierkorb löscht auch beendete Serien aus der Übersicht und entfernt deren offene Blätter ohne gespeicherte Arbeitszeit; erledigte Aufgaben und erfasste Zeiten bleiben erhalten. Gelöschte Serien werden intern als gelöscht markiert, damit keine Blätter neu entstehen. Ausgefallene Einheiten entfernen zugehörige offene Blätter ohne gespeicherte Arbeitszeit; erledigte Blätter und bereits erfasste Arbeit bleiben erhalten. Wird ein Termin wieder aufgenommen, erscheint sein Blatt wieder, sofern es nicht ausdrücklich gelöscht oder die Serie beendet wurde.

Cloud-Speicheraufrufe wiederholen vorübergehende Netzwerkfehler bis zu zweimal mit derselben Datensatz-ID. Fehlermeldungen und Hinweise verschwinden nach sieben Sekunden; ein neuer Speicherversuch entfernt vorherige Hinweise sofort. Die Kursbalken verwenden Indigo für Selbststudium und Mint für Lehrveranstaltungen.

## Kalender und Zeit erfassen

Die Aufgabenleiste links im Kalender trennt Uni und Privat. Eine Karte auf die gewünschte Uhrzeit ziehen; am Handy kann alternativ „Planen“ verwendet werden. Neue Aufgaben direkt über das Plus in der Leiste erstellen. Privat auswählen und eine Kategorie wählen oder selbst eingeben (etwa Haushalt, Sport oder Einkaufen). Kategorien nutzen das vorhandene Feld `type`, es ist keine Datenbankmigration erforderlich.

Unter Zeiterfassung eine Aufgabe auswählen und „Timer starten“ drücken. Der Timer zeigt Stunden, Minuten und Sekunden; Pause/Fortsetzen und „Stoppen & speichern“ sind dort sowie in der seitenübergreifenden Timerleiste verfügbar. Private Aufgaben haben standardmäßig keine Zeiterfassung, sie kann im Aufgabendialog aktiviert werden. „Verwerfen“ fragt vor dem Verlust ungespeicherter Zeit nach.

Aufgaben werden in einer kompakten Liste angezeigt. Offen/Erledigt/Alle sind direkt erreichbar; weitere kombinierbare Filter lassen sich über „Filter“ einblenden. Auf den Kursseiten wechseln Aufgaben, Planung und Arbeitszeiten über Reiter. Der Menüknopf oben links blendet die Seitenleiste am Desktop vollständig aus und wieder ein; die Auswahl bleibt im Browser gespeichert.

Kalenderkarten am Titel/Griff hineinziehen (Touch: kurz halten). Obere und untere Ziehgriffe ändern Beginn bzw. Ende in 15-Minuten-Schritten. Die Hauptnavigation lässt sich durch eine Wischgeste nach links innerhalb der Seitenleiste schließen, auch per horizontaler Trackpad-Geste.

Der Kalender nutzt die verfügbare Inhaltsbreite. „Aufgaben ausblenden“ schafft zusätzliche Breite; „Große Ansicht“ öffnet den Kalender über die gesamte App-Fläche (zurück über den Button oder Escape). Private geplante Aufgaben erscheinen lila mit der Kennzeichnung „Privat“. Ungeplante private Aufgaben stehen weiterhin in der Aufgabenliste und im Privat-Reiter der Planungsleiste.

Die Fokusansicht zeigt einen Zeitring mit wählbaren 25/45/60 Minuten als Orientierung. Der Timer stoppt nicht automatisch beim Erreichen der Dauer. „Heute gelernt“ summiert ausschließlich gespeicherte Uni-Zeiten innerhalb des aktuellen Tages. Doppeltipp-Zoom wird durch `touch-action: manipulation` reduziert; bewusstes Pinch-/Browser-Zoomen bleibt möglich. Auf mobilen Geräten verhindern 16px-Eingabeschriften unbeabsichtigtes Zoomen beim Fokussieren von Formularfeldern.

Ein Klick auf einen Kalenderblock wählt ihn aus. Bearbeiten wird ausdrücklich über den gleichnamigen Button geöffnet. Die Auswahlleiste erlaubt außerdem −15/+15 Minuten (Mindestdauer 15 Minuten). Freies Ziehen im Raster öffnet keinen Anlegedialog mehr; neue Blöcke werden über „Block planen“ oder Aufgaben-Drag-and-drop erstellt. Große Ansicht blendet die Aufgabenleiste zunächst aus. Auf kleinen Bildschirmen öffnet sich diese als Overlay, sodass das Kalender-Zeitraster weiterhin die volle verfügbare Höhe nutzt.

Zeiten ohne Aufgabe: Bei bestehenden Supabase-Projekten einmal `supabase/optional-task-time.sql` im SQL Editor ausführen. Die Migration erhält vorhandene Einträge und ermöglicht direkte Kurs- und Privatzeiten. Lokale SQLite-Datenbanken werden automatisch aktualisiert.

Auf dem iPad: In Safari öffnen → Teilen → Zum Home-Bildschirm → Als Web-App öffnen. Updates in der installierten App über Einstellungen → App aktualisieren laden. Dieser Button lädt mit einer neuen URL ohne den alten HTML-Cache; Anmeldung und laufende Timer werden nicht gelöscht. Der Versionszeitpunkt steht unter dem Button.

Speichern: Während einer laufenden Anfrage zeigt der Dialog „Wird gespeichert …“ und verhindert Mehrfachklicks. Bestätigte Änderungen erscheinen direkt, ohne erneutes Laden aller Tabellen. Bei einem Fehler bleibt der Dialog offen; gestoppte Timer bleiben mit ihrer erfassten Dauer pausiert und können erneut gespeichert werden.

ECTS können mit Komma oder Punkt eingegeben werden (z. B. 2,5). Zahlenfelder lassen sich während der Eingabe vollständig leeren. Beim manuellen Nachtragen kann die Dauer direkt in Minuten angegeben werden; Beginn und Ende werden entsprechend angepasst. Kalenderaufgaben werden je Bereich nach Fälligkeit sortiert, Aufgaben ohne Deadline stehen zuletzt. Jede offene Aufgabe kann wiederholt für separate Arbeitseinheiten geplant werden.

Statistiken zeigen eine blätterbare Wochenansicht mit gestapelten Tagesbalken, Vorwochenvergleich, aktiven Tagen und erledigten Aufgaben. Grün steht für Selbststudium/Privatzeit, Lila für Lehrveranstaltungen. In Kursen unter „Wöchentliche Lehrveranstaltungen“ Termine mit Wochentag, Uhrzeit und Semesterzeitraum hinterlegen. Vollständig vergangene Termine werden automatisch angerechnet; zukünftige Termine bleiben unberücksichtigt. Ausfälle und Ferien über „Termine anzeigen“ je Datum mit „Termin entfällt“ ausschließen; „Wieder aufnehmen“ stellt den Termin wieder her. Beim Anlegen zwischen einzelnem Termin und wöchentlicher Serie wählen; Serien lassen sich über Enddatum oder eine feste Anzahl (z. B. sechs Termine) begrenzen. Manuelle Vorlesungs-/Übungszeiten ersetzen überlappende automatische Termine desselben Kurses. Die Anrechnung wird aus den vorhandenen Daten berechnet und erzeugt keine zusätzlichen gespeicherten Zeiteinträge; keine neue SQL-Migration nötig.

Die Kursbalken zeigen zwei Prozentwerte: Selbststudium geteilt durch ECTS-Gesamtstunden abzüglich geplanter LV-Stunden sowie Selbststudium plus vergangene LV-Zeit geteilt durch ECTS-Gesamtstunden. Beim Entfernen einer Terminserie entfällt auch deren automatisch berechneter Anteil. Manuell erfasste Zeiten bleiben erhalten.

Ausgefallene Lehrveranstaltungen werden in den vorhandenen Einstellungen gespeichert und mit dem Backup exportiert. Sie zählen weder als absolvierte noch als geplante LV-Stunden. Manuell erfasste Arbeitszeiten bleiben auch bei einem ausgeschlossenen Termin erhalten. Es ist keine zusätzliche Datenbankmigration nötig.
