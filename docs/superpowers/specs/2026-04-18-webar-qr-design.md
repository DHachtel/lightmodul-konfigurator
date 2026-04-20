# WebAR via QR-Code — Möbel im Raum platzieren

**Datum:** 2026-04-18
**Status:** Approved

## Ziel

Nach dem Speichern einer Konfiguration erscheint ein QR-Code-Icon neben der Möbel-ID. Klick öffnet ein Modal mit QR-Code. Handy scannt → Browser öffnet AR-Seite → Möbel wird mit korrekten Maßen und Oberflächen im Raum platziert. Kein App-Download nötig.

## Flow

```
Konfigurieren → Speichern → Möbel-ID + QR-Icon
                                    ↓ (Klick)
                              Modal: QR-Code + Anleitung
                                    ↓ (Handy scannt)
                              /ar?config=12345678
                                    ↓
                              Config aus DB laden → 3D bauen → GLB exportieren
                                    ↓
                              <model-viewer> mit AR-Platzierung
```

## Technologie

- **Google `<model-viewer>`** — Web Component für 3D + AR im Browser
- **Three.js `GLTFExporter`** — exportiert die Szene als GLB (client-seitig)
- **`qrcode`** — QR-Code-Generierung als Canvas/DataURL
- iOS: Scene Viewer / Quick Look (automatisch via model-viewer)
- Android: Scene Viewer (automatisch via model-viewer)

## Kein Server-Upload

Die AR-Seite baut das 3D-Modell live im Browser:
1. Lädt ConfigState aus Supabase via `/api/config/load?code=...`
2. Baut Three.js-Szene mit `useModuleGeometry()` (gleiche Logik wie Konfigurator)
3. Exportiert als GLB via `GLTFExporter`
4. Übergibt GLB als Blob-URL an `<model-viewer>`

## Neue Dateien

| Datei | Zweck |
|-------|-------|
| `src/features/configurator/QRCodeModal.tsx` | Modal mit QR-Code + Anleitung |
| `src/app/ar/page.tsx` | AR-Viewer Seite (standalone, mobile-optimiert) |
| `src/app/ar/ARViewer.tsx` | Client Component: Three.js → GLB → model-viewer |

## QR-Code Modal (`QRCodeModal.tsx`)

- Trigger: QR-Icon neben der Möbel-ID im Header (nach Speichern)
- Modal zeigt:
  - Großer QR-Code (256×256px)
  - URL: `{APP_URL}/ar?config={moebelId}`
  - Kurzanleitung: "QR-Code mit dem Handy scannen → Möbel im Raum platzieren"
  - Möbel-ID + Maße als Info
  - Schließen-Button

## AR-Seite (`/ar`)

### Layout (mobile-first)
- Vollbild, kein Header/Sidebar
- `<model-viewer>` füllt den Bildschirm
- AR-Button prominent unten ("In meinem Raum ansehen")
- Fallback wenn kein AR: 3D-Rotation/Zoom
- Ladeindikator während Config geladen + GLB gebaut wird
- Fehlerfall: "Konfiguration nicht gefunden" wenn ungültige ID

### model-viewer Attribute
```html
<model-viewer
  src={glbBlobUrl}
  ar
  ar-modes="webxr scene-viewer quick-look"
  camera-controls
  touch-action="pan-y"
  auto-rotate
  shadow-intensity="1"
  style="width: 100%; height: 100vh;"
>
  <button slot="ar-button">In meinem Raum ansehen</button>
</model-viewer>
```

### GLB-Export Logik
1. Erstelle unsichtbare Three.js-Szene (kein Canvas nötig, nur Geometrie)
2. Nutze `useModuleGeometry(config)` für Szene-Objekte
3. Baue Meshes: Platten (MeshStandardMaterial + Farbe), Profile (Alu), Griffe (GLB), Füße
4. `GLTFExporter.parse(scene)` → GLB-ArrayBuffer → Blob → URL
5. Übergib URL an `<model-viewer src={url}>`

### Maßstab
- Three.js-Einheiten im Konfigurator: 1mm = 0.01 Einheiten
- `<model-viewer>` erwartet Meter
- Skalierung: Three.js-Szene × 0.001 beim Export (0.01 Einheiten × 0.001 = 0.00001 = real scale)
- Oder: Export ohne Skalierung, model-viewer `scale` Attribut nutzen

## Dependencies

```bash
npm install qrcode @types/qrcode
```

`@google/model-viewer` wird als Script-Tag geladen (CDN), nicht als npm-Package — einfacher für eine einzelne Seite.

## Einschränkungen

- **iOS Quick Look** braucht eigentlich USDZ — `<model-viewer>` fällt auf WebXR zurück wenn der Browser es unterstützt (Safari 16.4+). Ältere iOS-Versionen zeigen nur 3D-Rotation.
- **Texturen:** Holz/Alu-Texturen müssen in die GLB eingebettet werden (als Bilder). PBR-Maps (Normal, Roughness) werden mitexportiert.
- **Performance:** Komplexe Möbel (8×10 Grid) könnten auf älteren Handys langsam laden. GLB-Größe schätzen: ~1-5 MB je nach Komplexität.
- **Offline:** Nicht möglich — Seite braucht Internet für Config-Load + model-viewer.

## Nicht im Scope

- USDZ-Server-Export (nur wenn iOS Quick Look zwingend nötig)
- Speichern der GLB-Datei in Supabase Storage
- AR-Tracking / Messung im Raum
- Multi-Möbel AR (nur ein Möbel pro Session)
