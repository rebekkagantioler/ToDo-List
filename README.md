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

## Persönliches Konto

Die Anmeldung verwendet Benutzername und Passwort; die Registrierung in der App ist entfernt. `VITE_LOGIN_USERNAME` und `VITE_LOGIN_EMAIL` ordnen den Namen einem bestehenden Supabase-Konto zu. Beide Werte müssen lokal in `.env` und für GitHub Pages als Repository-Variablen gesetzt werden. Das Passwort wird ausschließlich an Supabase Auth gesendet. Alle VITE-Werte einschließlich der Kontoadresse sind im ausgelieferten Browser-Code sichtbar; sie sind keine Geheimnisse.

Nach Einrichtung des Kontos unter Supabase Authentication → Sign In / Providers „Allow new users to sign up“ deaktivieren, damit auch über die API keine weiteren Registrierungen möglich sind. Das Entfernen des Registrierungsbuttons allein setzt diese Projekteinstellung nicht. Die Benutzertrennung bleibt über RLS erhalten. Ein bereits unbestätigtes Konto muss weiterhin einmal bestätigt werden; die App umgeht diese serverseitige Regel nicht.

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

Statistiken zeigen eine blätterbare Wochenansicht mit gestapelten Tagesbalken, Vorwochenvergleich, aktiven Tagen und erledigten Aufgaben. Grün steht für Selbststudium/Privatzeit, Lila für Lehrveranstaltungen. In Kursen unter „Wöchentliche Lehrveranstaltungen“ Termine mit Wochentag, Uhrzeit und Semesterzeitraum hinterlegen. Vollständig vergangene Termine werden automatisch angerechnet; zukünftige Termine bleiben unberücksichtigt. Für Ferien getrennte Zeiträume anlegen. Manuelle Vorlesungs-/Übungszeiten ersetzen überlappende automatische Termine desselben Kurses. Die Anrechnung wird aus den vorhandenen Daten berechnet und erzeugt keine zusätzlichen gespeicherten Zeiteinträge; keine neue SQL-Migration nötig.

Die Kursbalken zeigen zwei Prozentwerte: Selbststudium geteilt durch ECTS-Gesamtstunden abzüglich geplanter LV-Stunden sowie Selbststudium plus vergangene LV-Zeit geteilt durch ECTS-Gesamtstunden. Beim Entfernen einer Terminserie entfällt auch deren automatisch berechneter Anteil. Manuell erfasste Zeiten bleiben erhalten.
