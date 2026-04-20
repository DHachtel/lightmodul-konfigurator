# Platten buendig in Profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Platten buendig in die Alu-Profile eingefasst, Plattendicke korrigiert (16mm), Kantenrundung, Stellfuesse/Rollen an allen unteren Wuerfeln.

**Architecture:** Aenderungen konzentrieren sich auf `useModuleGeometry.ts` (Positionierung), `Preview3D.tsx` (RoundedBox-Rendering + Rollen-partType), `renderOffscreenSnapshot.ts` (Dicke-Konstante). Die Profillogik bleibt unveraendert.

**Tech Stack:** Three.js, React Three Fiber, @react-three/drei (RoundedBox)

---

## Task 1: Konstanten und Plattendicke korrigieren

**Files:**
- Modify: `src/features/preview3d/useModuleGeometry.ts:25-31`
- Modify: `src/features/preview3d/Preview3D.tsx:15`

- [ ] **Step 1: Konstanten in useModuleGeometry.ts aendern**

```typescript
const s      = 0.01; // Skalierung: 1mm = 0.01 Three.js-Einheiten
const t      = 16;   // Plattendicke in mm (real: 16.2mm, gerundet)
const frontT = 16;   // Frontplattendicke in mm
const NUT    = 4;    // Nuttiefe pro Seite in mm — Plattenmass = Achsmass - 2*NUT
const PLATE_RADIUS = 2; // Kantenrundung in mm (Annaeherung)
const HANDLE_COLOR = '#3a3835';
const CHROME       = '#d4dce4';
const pd           = 30;
const pd_i         = 2;
const ROLLE_COLOR  = '#1a1a1a'; // Schwarz fuer Rollen
```

- [ ] **Step 2: Konstante T in Preview3D.tsx aendern**

```typescript
const T = 16;   // Plattendicke mm
```

- [ ] **Step 3: tsc --noEmit ausfuehren**

Run: `tsc --noEmit`
Expected: 0 Fehler

- [ ] **Step 4: Commit**

```bash
git add src/features/preview3d/useModuleGeometry.ts src/features/preview3d/Preview3D.tsx
git commit -m "3D: Plattendicke 19→16mm, NUT/PLATE_RADIUS/ROLLE_COLOR Konstanten"
```

---

## Task 2: Plattenpositionierung — Achsmass-zentriert

**Files:**
- Modify: `src/features/preview3d/useModuleGeometry.ts:34-168`

Die gesamte Platten-Positionierungslogik wird auf Achsmass-zentrierte Berechnung umgestellt. Profile bleiben unveraendert.

- [ ] **Step 1: Helper-Funktionen colXLeft und rowYBot durch Wuerfelmitte-basierte Helper ersetzen**

Die bisherigen Helper `colXLeft` und `rowYBot` berechnen Innenkanten mit `t`-Offset. Neu: Wuerfelmitten als Referenzpunkte.

Ersetze die Helper (Zeile 69–80) und die Platten-Erzeugungslogik (Zeile 84–168) durch:

```typescript
    // ── Wuerfelmitte-Positionen (Achsmass-basiert) ────────────────────────
    // X-Positionen der vertikalen Wuerfelmitten (nC + 1 Stueck)
    const cubeX: number[] = [];
    {
      let x = xOff;
      cubeX.push(x);
      for (let ci = 0; ci < nC; ci++) {
        x += activeColWidths[ci];
        cubeX.push(x);
      }
    }

    // Y-Positionen der horizontalen Wuerfelmitten (nR + 1 Stueck)
    // ri=0 = oberste Zeile → hoechste Y-Position
    const cubeY: number[] = [];
    {
      let y = yOff + H;
      cubeY.push(y); // oberstes Wuerfelniveau
      for (let ri = 0; ri < nR; ri++) {
        y -= activeRowHeights[ri];
        cubeY.push(y);
      }
    }

    const objs: SceneObject[] = [];

    // ── Per-cell: Platten, Waende, Rueckwand ─────────────────────────────
    for (let ri = 0; ri < nR; ri++) {
      const r = minR + ri;
      // Wuerfelmitten oben/unten fuer diese Zeile
      const wmT = cubeY[ri];       // obere Wuerfelmitte-Y
      const wmB = cubeY[ri + 1];   // untere Wuerfelmitte-Y
      const cellCtrY = (wmT + wmB) / 2;
      const plateH = (wmT - wmB) - 2 * NUT; // Plattenhoehe = Achsmass_V - 8

      for (let ci = 0; ci < nC; ci++) {
        const c = minC + ci;
        if (!occ(r, c)) continue;

        // Wuerfelmitten links/rechts fuer diese Spalte
        const wmL = cubeX[ci];       // linke Wuerfelmitte-X
        const wmR = cubeX[ci + 1];   // rechte Wuerfelmitte-X
        const cellCtrX = (wmL + wmR) / 2;
        const plateW = (wmR - wmL) - 2 * NUT; // Plattenbreite = Achsmass_H - 8

        const plateD = D - 2 * NUT; // Plattentiefe = Tiefe-Achsmass - 8

        // Rueckwand — in Nut eingeschoben (Z = NUT + t/2)
        objs.push({
          id: `ruecken_r${r}_c${c}`, partType: 'ruecken',
          position: [cellCtrX * s, cellCtrY * s, (NUT + t / 2) * s],
          size: [plateW * s, plateH * s, t * s],
          color, catKey: 'ruecken', partColorKey: 'rueckwand',
        });

        // Linke Seitenwand (nur wenn links nicht belegt)
        if (!occ(r, c - 1)) {
          objs.push({
            id: `seite_l_r${r}_c${c}`, partType: 'seite_l',
            position: [wmL * s, cellCtrY * s, (D / 2) * s],
            size: [t * s, plateH * s, plateD * s],
            color, catKey: 'seite_aussen', partColorKey: 'seite_l',
          });
        }

        // Rechte Seitenwand / Zwischenwand
        if (!occ(r, c + 1)) {
          objs.push({
            id: `seite_r_r${r}_c${c}`, partType: 'seite_r',
            position: [wmR * s, cellCtrY * s, (D / 2) * s],
            size: [t * s, plateH * s, plateD * s],
            color, catKey: 'seite_aussen', partColorKey: 'seite_r',
          });
        } else {
          objs.push({
            id: `zwischenwand_r${r}_c${c}`, partType: 'zwischenwand',
            position: [wmR * s, cellCtrY * s, (D / 2) * s],
            size: [t * s, plateH * s, plateD * s],
            color, catKey: 'seite_innen',
          });
        }

        // Boden / Zwischenboden (untere Kante)
        if (!occ(r + 1, c)) {
          objs.push({
            id: `boden_r${r}_c${c}`, partType: 'boden',
            position: [cellCtrX * s, wmB * s, (D / 2) * s],
            size: [plateW * s, t * s, plateD * s],
            color, catKey: 'boden', partColorKey: 'boden',
          });
        } else {
          objs.push({
            id: `zwischenboden_r${r}_c${c}`, partType: 'zwischenboden',
            position: [cellCtrX * s, wmB * s, (D / 2) * s],
            size: [plateW * s, t * s, plateD * s],
            color, catKey: 'boden',
          });
        }

        // Deckel (obere Kante — nur wenn oben nicht belegt)
        if (!occ(r - 1, c)) {
          objs.push({
            id: `deckel_r${r}_c${c}`, partType: 'deckel',
            position: [cellCtrX * s, wmT * s, (D / 2) * s],
            size: [plateW * s, t * s, plateD * s],
            color, catKey: 'boden', partColorKey: 'deckel',
          });
        }
      }
    }
```

- [ ] **Step 2: tsc --noEmit ausfuehren**

Run: `tsc --noEmit`
Expected: 0 Fehler

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/useModuleGeometry.ts
git commit -m "3D: Plattenpositionierung Achsmass-zentriert (buendig in Profil)"
```

---

## Task 3: Fronten-Positionierung anpassen

**Files:**
- Modify: `src/features/preview3d/useModuleGeometry.ts` (Fronten-Abschnitt, ca. Zeile 171–275)

Fronten muessen ebenfalls Achsmass-basiert dimensioniert werden und in der Nut sitzen.

- [ ] **Step 1: Fronten-Abschnitt mit cubeX/cubeY-Referenzen umschreiben**

```typescript
    // ── Fronten & Griffe ───────────────────────────────────────────────
    // Frontplatte sitzt in der vorderen Nut: Z = D - NUT - frontT/2
    const frontZ  = D - NUT - frontT / 2;
    const handleZ = D + 5; // Griff: 5mm vor der Profilkante (D = Achsmass Tiefe)

    for (let ri = 0; ri < nR; ri++) {
      const r = minR + ri;
      const wmT = cubeY[ri];
      const wmB = cubeY[ri + 1];
      const cellCtrY = (wmT + wmB) / 2;
      const plateH = (wmT - wmB) - 2 * NUT;

      for (let ci = 0; ci < nC; ci++) {
        const c   = minC + ci;
        const typ = grid[r]?.[c]?.type;
        if (!typ || typ === 'O') continue;

        const wmL = cubeX[ci];
        const wmR_pos = cubeX[ci + 1];
        const cellCtrX = (wmL + wmR_pos) / 2;
        const plateW = (wmR_pos - wmL) - 2 * NUT;

        // Frontplatte
        objs.push({
          id: `front_r${r}_c${c}`,
          partType: 'front',
          position: [cellCtrX * s, cellCtrY * s, frontZ * s],
          size:     [plateW * s, plateH * s, frontT * s],
          color, catKey: `front_${typ}`,
          row: r, col: c, partColorKey: 'front',
        });

        // Griff je Fronttyp (X/Y-Positionen relativ zu Wuerfelmitten)
        const handleGlb = HANDLE_GLB_MAP[state.handle];
        const hRotH: [number, number, number] = [-Math.PI / 2, 0, 0];
        const hRotV: [number, number, number] = [-Math.PI / 2, 0, Math.PI / 2];

        const yTop = wmT - NUT; // oberer Plattenrand
        if (typ === 'K') {
          objs.push({
            id: `handle_r${r}_c${c}`, partType: 'handle',
            position: [cellCtrX * s, (yTop - 35) * s, handleZ * s],
            size: [80 * s, 12 * s, 8 * s],
            color: HANDLE_COLOR, row: r, col: c,
            glbFile: handleGlb, preRotation: hRotH,
          });
        } else if (typ === 'S') {
          objs.push({
            id: `handle_r${r}_c${c}`, partType: 'handle',
            position: [cellCtrX * s, cellCtrY * s, handleZ * s],
            size: [80 * s, 12 * s, 8 * s],
            color: HANDLE_COLOR, row: r, col: c,
            glbFile: handleGlb, preRotation: hRotH,
          });
        } else if (typ === 'TR') {
          const xRight = wmR_pos - NUT; // rechter Plattenrand
          objs.push({
            id: `handle_r${r}_c${c}`, partType: 'handle',
            position: [(xRight - 35) * s, cellCtrY * s, handleZ * s],
            size: [12 * s, 80 * s, 8 * s],
            color: HANDLE_COLOR, row: r, col: c,
            glbFile: handleGlb, preRotation: hRotV,
          });
        } else if (typ === 'TL') {
          const xLeft = wmL + NUT; // linker Plattenrand
          objs.push({
            id: `handle_r${r}_c${c}`, partType: 'handle',
            position: [(xLeft + 35) * s, cellCtrY * s, handleZ * s],
            size: [12 * s, 80 * s, 8 * s],
            color: HANDLE_COLOR, row: r, col: c,
            glbFile: handleGlb, preRotation: hRotV,
          });
        } else if (typ === 'DT') {
          objs.push({
            id: `handle_r${r}_c${c}_l`, partType: 'handle',
            position: [(cellCtrX - 25) * s, cellCtrY * s, handleZ * s],
            size: [12 * s, 80 * s, 8 * s],
            color: HANDLE_COLOR, row: r, col: c,
            glbFile: handleGlb, preRotation: hRotV,
          });
          objs.push({
            id: `handle_r${r}_c${c}_r`, partType: 'handle',
            position: [(cellCtrX + 25) * s, cellCtrY * s, handleZ * s],
            size: [12 * s, 80 * s, 8 * s],
            color: HANDLE_COLOR, row: r, col: c,
            glbFile: handleGlb, preRotation: hRotV,
          });
        }
      }
    }
```

- [ ] **Step 2: tsc --noEmit ausfuehren**

Run: `tsc --noEmit`
Expected: 0 Fehler

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/useModuleGeometry.ts
git commit -m "3D: Fronten Achsmass-zentriert + handleZ an Profilkante"
```

---

## Task 4: Profil-Eckpositionen an neue Wuerfelmitte-Arrays anpassen

**Files:**
- Modify: `src/features/preview3d/useModuleGeometry.ts` (Profil-Abschnitt, ca. Zeile 277–420)

Die Profil-Eckberechnung (pxL, pxR, pyT, pyB) muss die `cubeX`/`cubeY`-Arrays nutzen statt der alten `sumCols`/`sumRows`-Logik.

- [ ] **Step 1: Profil-Eckpositionen durch cubeX/cubeY ersetzen**

Im Profil-Abschnitt: Ersetze die Berechnung von `pxL`, `pxR`, `pyT`, `pyB` (bisher per `sumCols`/`sumRows`) durch:

```typescript
        const pxL = cubeX[ci];
        const pxR = cubeX[ci + 1];
        const pyT = cubeY[ri];
        const pyB = cubeY[ri + 1];
```

Entferne die `sumCols`/`sumRows`-Hilfsfunktionen (Zeilen 300-301 alt), da sie durch `cubeX`/`cubeY` ersetzt sind.

- [ ] **Step 2: tsc --noEmit + visueller Check**

Run: `tsc --noEmit`
Expected: 0 Fehler. Profile muessen weiterhin an den Wuerfelmitten sitzen.

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/useModuleGeometry.ts
git commit -m "3D: Profil-Eckpositionen via cubeX/cubeY statt sumCols/sumRows"
```

---

## Task 5: Stellfuesse an allen unteren Wuerfeln + Rollen

**Files:**
- Modify: `src/features/preview3d/useModuleGeometry.ts` (Stellfuss-Abschnitt, ca. Zeile 450–477)
- Modify: `src/features/preview3d/useModuleGeometry.ts:8-12` (partType um 'rolle' erweitern)
- Modify: `src/features/preview3d/Preview3D.tsx:385-388` (strukturObjs Filter um 'rolle' erweitern)

- [ ] **Step 1: partType-Union um 'rolle' erweitern**

In `SceneObject.partType` (Zeile 8-12):

```typescript
  partType:
    | 'seite_l' | 'seite_r' | 'boden' | 'deckel' | 'ruecken'
    | 'zwischenboden' | 'zwischenwand'
    | 'front' | 'handle' | 'profil'
    | 'eckverbinder' | 'stellfuss' | 'rolle';
```

- [ ] **Step 2: Stellfuss/Rollen-Logik komplett ersetzen**

Ersetze den gesamten Stellfuss-Abschnitt (ab `// ── Stellfuesse`) durch:

```typescript
    // ── Stellfuesse / Rollen — an allen unteren Wuerfeln ──────────────────
    // Untere Wuerfel = alle cornerPositions mit y === cubeY[nR] (unterste Zeile)
    const isStell = state.footer.startsWith('stell');
    const isRolle = state.footer.startsWith('rolle');

    if (isStell || isRolle) {
      const footerGlb = isStell
        ? STRUCTURE_GLB_MAP['stellfuss']
        : STRUCTURE_GLB_MAP['rolle'];
      const footerColor = isStell ? CHROME : ROLLE_COLOR;
      const footerType: SceneObject['partType'] = isStell ? 'stellfuss' : 'rolle';
      const footerH = isStell
        ? (parseInt(state.footer.replace('stell', ''), 10) || 50)
        : 60; // Rolle: 60mm Durchmesser
      const footerSize: [number, number, number] = [30 * s, footerH * s, 30 * s];

      // Alle X-Positionen der unteren Wuerfelreihe
      const bottomY = cubeY[nR]; // unterste Wuerfelmitte-Y
      const footerY = (bottomY - hw - footerH / 2) * s; // unterhalb des Wuerfels

      for (let ci = 0; ci <= nC; ci++) {
        const wx = cubeX[ci];
        // Vorne und hinten je ein Fuss/Rolle
        objs.push({
          id: `${footerType}_f_${ci}`,
          partType: footerType,
          position: [wx * s, footerY, wuerfelZf * s],
          size: footerSize,
          color: footerColor,
          glbFile: footerGlb,
        });
        objs.push({
          id: `${footerType}_b_${ci}`,
          partType: footerType,
          position: [wx * s, footerY, wuerfelZb * s],
          size: footerSize,
          color: footerColor,
          glbFile: footerGlb,
        });
      }
    }
```

- [ ] **Step 3: Preview3D.tsx — strukturObjs-Filter um 'rolle' erweitern**

In Preview3D.tsx, Zeile 385-388:

```typescript
  const strukturObjs = useMemo(
    () => objects.filter(o =>
      o.partType === 'eckverbinder' || o.partType === 'stellfuss' || o.partType === 'rolle'),
    [objects],
  );
```

- [ ] **Step 4: tsc --noEmit ausfuehren**

Run: `tsc --noEmit`
Expected: 0 Fehler

- [ ] **Step 5: Commit**

```bash
git add src/features/preview3d/useModuleGeometry.ts src/features/preview3d/Preview3D.tsx
git commit -m "3D: Stellfuesse/Rollen an allen unteren Wuerfeln, zentral eingesteckt"
```

---

## Task 6: RoundedBox fuer Platten-Rendering

**Files:**
- Modify: `src/features/preview3d/Preview3D.tsx` (PlattenPart-Komponente, Zeile 229-322)

- [ ] **Step 1: RoundedBox importieren**

In Preview3D.tsx, Import-Zeile 5:

```typescript
import { ContactShadows, CameraControls, Edges, RoundedBox } from '@react-three/drei';
```

- [ ] **Step 2: PLATE_RADIUS Konstante hinzufuegen**

Nach Zeile 15 (`const T = 16;`):

```typescript
const PLATE_R = 2 * S; // Kantenrundung: 2mm in Three.js-Einheiten
```

- [ ] **Step 3: PlattenPart auf RoundedBox umstellen**

In PlattenPart (return-Block, ca. Zeile 298-321), ersetze `<mesh>` + `<boxGeometry>` durch `<RoundedBox>`:

```typescript
  return (
    <>
      <RoundedBox
        args={obj.size}
        radius={PLATE_R}
        smoothness={4}
        position={obj.position}
        castShadow
        receiveShadow
        onClick={obj.row != null && obj.col != null && onSelect
          ? (e) => { e.stopPropagation(); onSelect(obj.row!, obj.col!); }
          : undefined}
      >
        <meshStandardMaterial
          color={effectiveColor}
          roughness={roughness}
          metalness={metalness}
          envMapIntensity={envMapIntensity}
          map={woodMap}
        />
      </RoundedBox>
      <lineSegments position={obj.position} geometry={edgesGeo}>
        <lineBasicMaterial color="#333333" opacity={0.12} transparent />
      </lineSegments>
    </>
  );
```

- [ ] **Step 4: tsc --noEmit ausfuehren**

Run: `tsc --noEmit`
Expected: 0 Fehler

- [ ] **Step 5: Commit**

```bash
git add src/features/preview3d/Preview3D.tsx
git commit -m "3D: RoundedBox fuer Platten (2mm Kantenrundung)"
```

---

## Task 7: renderOffscreenSnapshot.ts aktualisieren

**Files:**
- Modify: `src/features/preview3d/renderOffscreenSnapshot.ts`

Der Offscreen-Renderer nutzt `computeModuleGeometry()` direkt — die Positionsaenderungen aus Task 2-5 wirken automatisch. Nur die BoxGeometry bleibt (kein RoundedBox im Offscreen — Three.js pur, kein drei).

- [ ] **Step 1: Keine Code-Aenderung noetig**

`renderOffscreenSnapshot.ts` liest nur `computeModuleGeometry(state)` und erzeugt BoxGeometry fuer alle Objekte. Die Positionierung kommt komplett aus `useModuleGeometry.ts`, das bereits in Task 2-5 aktualisiert wurde. BoxGeometry bleibt im Snapshot (Annaeherung reicht fuer PDF).

Verifizieren: Die Datei nutzt keine eigenen `t`/`T`-Konstanten fuer Positionierung.

- [ ] **Step 2: Commit (nur falls Aenderungen noetig waren)**

Kein Commit noetig, wenn keine Aenderung.

---

## Task 8: BoundingBox in Preview3D.tsx anpassen

**Files:**
- Modify: `src/features/preview3d/Preview3D.tsx` (Zeile 348-366)

Die BoundingBox-Berechnung fuer Kamera-AutoFrame nutzt `T` fuer die Aussenabmessungen. Mit der neuen Achsmass-zentrierung aendert sich die Gesamtgroesse.

- [ ] **Step 1: BoundingBox an Achsmass-Logik anpassen**

```typescript
  // Moebel-BoundingBox fuer fitToBox — in Three.js-Einheiten
  // Wuerfelmitten sitzen bei xOff, xOff+wAct; Wuerfel ragen 15mm raus
  const boxMinX = (xOff - 15) * S;
  const boxMinY = (yOff - 15) * S;
  const boxMinZ = -0.15; // Wuerfel ragen 15mm nach hinten
  const boxMaxX = (xOff + wAct + 15) * S;
  const boxMaxY = (yOff + hAct + 15) * S;
  const boxMaxZ = (state.depth + 15 + 10) * S; // Wuerfel + etwas Luft
```

- [ ] **Step 2: outerW/outerH anpassen**

```typescript
  const outerW = wAct * S;
  const outerH = hAct * S;
```

- [ ] **Step 3: groundCx/groundCz anpassen**

```typescript
  const groundCx = (xOff + wAct / 2) * S;
  const groundCz = state.depth / 2 * S;
```

- [ ] **Step 4: tsc --noEmit ausfuehren**

Run: `tsc --noEmit`
Expected: 0 Fehler

- [ ] **Step 5: Commit**

```bash
git add src/features/preview3d/Preview3D.tsx
git commit -m "3D: BoundingBox/Kamera an Achsmass-Positionierung angepasst"
```

---

## Task 9: Visueller Abschlusstest

- [ ] **Step 1: Dev-Server starten und pruefen**

Run: `npm run dev`

Visuell pruefen:
1. Platten sitzen buendig in Profilen — kein sichtbarer Rand
2. Fronten gleiche Groesse wie Rueckwaende, mit Griff
3. Kantenrundung sichtbar an Plattenraendern
4. Stellfuesse zentral unter allen unteren Wuerfeln
5. Rollen (Footer umschalten): schwarz, gleiche Positionierung wie Stellfuesse
6. Mehrere Spalten nebeneinander: korrekte Anzahl Fuesse/Rollen (N+1)*2
7. Kamera-AutoFrame funktioniert bei verschiedenen Moebel-Groessen

- [ ] **Step 2: tsc --noEmit + Abschluss-Commit**

Run: `tsc --noEmit`
Expected: 0 Fehler

Falls Korrekturen noetig: beheben und committen.
