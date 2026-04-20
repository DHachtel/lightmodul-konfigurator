# Prompt: Dokumentation aktualisieren
## Nach jeder Claude Code Session ausführen

---

Aktualisiere die Projektdokumentation in `PROJECT_STATUS.html` im Root des Projekts.

Lese zuerst die aktuelle `PROJECT_STATUS.html` sowie `CLAUDE.md`.

Führe dann folgende Aktualisierungen durch:

**1. Datum oben rechts**
Setze das "Zuletzt aktualisiert"-Datum auf das heutige Datum.

**2. Ausgeführte Schritte**
Füge oben in der Log-Tabelle (neueste zuerst) eine neue Zeile ein mit:
- Heutigem Datum
- Kurzem Titel des ausgeführten Schritts
- Details: welche Dateien wurden erstellt/geändert, was wurde implementiert, Ergebnisse (z.B. "tsc: 0 Fehler")
- Status: ✓ wenn erfolgreich, ⚠ wenn mit Problemen abgeschlossen

**3. Nächste Schritte**
Aktualisiere die Todo-Liste basierend auf dem was gerade abgeschlossen wurde:
- Abgeschlossene Todos entfernen oder auf erledigt setzen
- Neue Todos hinzufügen die sich aus der aktuellen Arbeit ergeben
- Prioritäten (1/2/3) anpassen

**4. Offene Punkte**
- Neu entdeckte Probleme oder Beobachtungen als dot-open hinzufügen
- Gelöste Punkte auf dot-closed setzen

**5. Phasen-Status**
- Wenn eine Phase abgeschlossen wurde: badge-active → badge-done
- Wenn eine neue Phase beginnt: badge-planned → badge-active

**6. Technische Entscheidungen**
Wenn in dieser Session eine wichtige Architektur- oder Technologie-Entscheidung getroffen wurde, als neuen decision-item eintragen.

Speichere die aktualisierte Datei als `PROJECT_STATUS.html` im Root-Verzeichnis des Projekts (neben `CLAUDE.md` und `package.json`).

Zeige mir danach eine kurze Zusammenfassung was du aktualisiert hast.
