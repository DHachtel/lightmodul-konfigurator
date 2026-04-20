"""
DXF → GLB Batch-Konverter für Artmodul-Projekt
Ausführen mit: python convert_dxf_to_glb.py

Benötigt: pip install ezdxf trimesh numpy
"""

import os
import sys
import numpy as np

def install_deps():
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "ezdxf", "trimesh", "numpy", "-q"])

try:
    import ezdxf
    import trimesh
except ImportError:
    print("Installiere Abhängigkeiten...")
    install_deps()
    import ezdxf
    import trimesh

# ── Pfade ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR  = os.path.join(SCRIPT_DIR, "DXF-Dateien")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "public", "models")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Dateiname normalisieren (Umlaute → ASCII, Leerzeichen → _) ───────────────
def normalize_name(name):
    name = name.replace("ü", "ue").replace("Ü", "Ue")
    name = name.replace("ö", "oe").replace("Ö", "Oe")
    name = name.replace("ä", "ae").replace("Ä", "Ae")
    name = name.replace("ß", "ss")
    name = name.replace(" ", "_")
    name = name.replace("ß", "ss")
    return name.lower()

# ── 3DFACE-Entities → Mesh ───────────────────────────────────────────────────
def extract_3dface(msp):
    vertices = []
    faces    = []
    idx = 0
    for e in msp.query("3DFACE"):
        pts = [e.dxf.vtx0, e.dxf.vtx1, e.dxf.vtx2, e.dxf.vtx3]
        # Wenn vtx2 == vtx3 → Dreieck, sonst Quad → zwei Dreiecke
        v = [(p.x, p.y, p.z) for p in pts]
        vertices.extend(v[:3])
        faces.append([idx, idx+1, idx+2])
        idx += 3
        if pts[2] != pts[3]:
            vertices.extend([v[0], v[2], v[3]])
            faces.append([idx, idx+1, idx+2])
            idx += 3
    return vertices, faces

# ── MESH-Entities → Mesh ─────────────────────────────────────────────────────
def extract_mesh(msp):
    vertices = []
    faces    = []
    for e in msp.query("MESH"):
        try:
            base_idx = len(vertices)
            verts = list(e.vertices)
            vertices.extend([(v.x, v.y, v.z) for v in verts])
            for face in e.faces:
                f = list(face)
                if len(f) == 3:
                    faces.append([base_idx + f[0], base_idx + f[1], base_idx + f[2]])
                elif len(f) == 4:
                    faces.append([base_idx + f[0], base_idx + f[1], base_idx + f[2]])
                    faces.append([base_idx + f[0], base_idx + f[2], base_idx + f[3]])
        except Exception as ex:
            print(f"    MESH-Fehler: {ex}")
    return vertices, faces

# ── POLYFACE MESH (POLYLINE mit PFACE-Flags) ─────────────────────────────────
# DXF POLYFACE: Vertex-Indizes sind 1-basiert, können negativ sein (Edge-Sichtbarkeit),
# vtx3 = 0 oder None bedeutet Dreieck (kein 4. Vertex).
def safe_idx(val):
    """Konvertiert 1-basierten DXF-Index (ggf. None/0/negativ) zu 0-basiertem Index."""
    if val is None:
        return None
    v = int(val)
    return abs(v) - 1 if v != 0 else None

def extract_polyface(msp):
    vertices = []
    faces    = []
    for e in msp.query("POLYLINE"):
        try:
            if not e.is_poly_face_mesh:
                continue
            # Geometrie-Vertices sammeln
            geom_verts = [v for v in e.vertices if v.is_poly_face_mesh_vertex]
            if not geom_verts:
                continue
            verts_pos = [(v.dxf.location.x, v.dxf.location.y, v.dxf.location.z)
                         for v in geom_verts]
            base_idx = len(vertices)
            vertices.extend(verts_pos)

            # Face-Records verarbeiten
            face_records = [v for v in e.vertices if v.is_face_record]
            for fv in face_records:
                # Indizes sicher auslesen (können None sein bei Dreiecken)
                i0 = safe_idx(fv.dxf.get("vtx0", None))
                i1 = safe_idx(fv.dxf.get("vtx1", None))
                i2 = safe_idx(fv.dxf.get("vtx2", None))
                i3 = safe_idx(fv.dxf.get("vtx3", None))

                # Mindestens 3 gültige Indizes benötigt
                if None in (i0, i1, i2):
                    continue

                if i3 is None or i3 == i2:
                    # Dreieck
                    faces.append([base_idx + i0, base_idx + i1, base_idx + i2])
                else:
                    # Quad → zwei Dreiecke
                    faces.append([base_idx + i0, base_idx + i1, base_idx + i2])
                    faces.append([base_idx + i0, base_idx + i2, base_idx + i3])

        except Exception as ex:
            print(f"    POLYFACE-Fehler: {ex}")
    return vertices, faces

# ── SOLID (4-Eckige Fläche, ähnlich 3DFACE) ──────────────────────────────────
def extract_solid(msp):
    vertices = []
    faces    = []
    idx = 0
    for e in msp.query("SOLID"):
        try:
            pts = [e.dxf.vtx0, e.dxf.vtx1, e.dxf.vtx2, e.dxf.vtx3]
            v = [(p.x, p.y, p.z) for p in pts]
            vertices.extend(v[:3])
            faces.append([idx, idx+1, idx+2])
            idx += 3
            if v[2] != v[3]:
                vertices.extend([v[0], v[2], v[3]])
                faces.append([idx, idx+1, idx+2])
                idx += 3
        except Exception as ex:
            print(f"    SOLID-Fehler: {ex}")
    return vertices, faces

# ── Hauptkonvertierung ────────────────────────────────────────────────────────
def convert_dxf_to_glb(dxf_path, glb_path):
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()

    # Alle Entity-Typen zählen für Diagnose
    types = {}
    for e in msp:
        t = e.dxftype()
        types[t] = types.get(t, 0) + 1
    print(f"    Entities: {dict(sorted(types.items()))}")

    all_verts = []
    all_faces = []

    for extractor in [extract_3dface, extract_mesh, extract_polyface, extract_solid]:
        v, f = extractor(msp)
        if f:
            offset = len(all_verts)
            all_verts.extend(v)
            all_faces.extend([[offset+i for i in face] for face in f])

    if not all_faces:
        print(f"    ⚠ Keine 3D-Geometrie gefunden — übersprungen")
        return False

    verts_np = np.array(all_verts, dtype=np.float64)
    faces_np = np.array(all_faces, dtype=np.int64)

    mesh = trimesh.Trimesh(vertices=verts_np, faces=faces_np, process=True)
    mesh.export(glb_path)
    print(f"    ✓ {len(mesh.vertices)} Vertices, {len(mesh.faces)} Faces → {os.path.basename(glb_path)}")
    return True

# ── Batch ─────────────────────────────────────────────────────────────────────
dxf_files = [f for f in os.listdir(INPUT_DIR) if f.lower().endswith(".dxf")]
print(f"\n🔄 Konvertiere {len(dxf_files)} DXF-Dateien nach {OUTPUT_DIR}\n")

success, skipped = 0, 0
for filename in sorted(dxf_files):
    base = os.path.splitext(filename)[0]
    glb_name = normalize_name(base) + ".glb"
    dxf_path = os.path.join(INPUT_DIR, filename)
    glb_path = os.path.join(OUTPUT_DIR, glb_name)

    print(f"  {filename}")
    try:
        ok = convert_dxf_to_glb(dxf_path, glb_path)
        if ok: success += 1
        else:   skipped += 1
    except Exception as ex:
        print(f"    ❌ Fehler: {ex}")
        skipped += 1

print(f"\n✅ Fertig: {success} konvertiert, {skipped} übersprungen")
print(f"📁 GLB-Dateien in: {OUTPUT_DIR}")
