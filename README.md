# ConSergio · landing 3D

Landing page scroll-driven per **consergio.ai**: un diorama 3D dell'*Hotel Belvedere* (struttura immaginaria)
modellato in Blender, raccontato con lo scroll:

1. **Hero** – il simbolo ConSergio in 3D (segue il mouse) vola dentro la camera 101
2. **Arrivo** – il taxi porta due ospiti all'hotel
3. **Reception** – la facciata si apre, coda alla reception, domande in 6 lingue
4. **Check-in** – gli ospiti prendono l'ascensore
5. **Camera 101** – sul comodino c'è il QR (vero, punta a consergio.ai)
6. **Chat** – il telefono inquadra il QR e ConSergio risponde
7. **Staff** – la richiesta vola alla reception e appare sulla bacheca
8. **Notte** – "Tu riposi. ConSergio risponde." poi le sezioni di contenuto

## Avvio

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build statica in dist/
```

## Blender

Tutto il 3D è generato da script Python, riproducibili:

| File | Cosa contiene |
|------|---------------|
| `blender/build_logo.py` | simbolo (teste + baffo) estruso dall'SVG ufficiale, gradiente di marca |
| `blender/build_hotel.py` | diorama completo: esterno, lobby, ascensore, camera 101, personaggi, taxi |
| `blender/consergio_logo.blend` | scena del logo, apribile e modificabile |
| `blender/hotel_scene.blend` | scena dell'hotel completa (oggetti NON uniti, comoda da editare) |
| `blender/renders/*.png` | render di anteprima |
| `blender/*_uncompressed.glb` | export glTF prima della compressione |
| `public/models/*.glb` | modelli usati dal sito (meshopt, ~600 KB in totale) |

Rigenerare i modelli dopo una modifica agli script:

```bash
npm run models     # Blender headless -> GLB -> compressione meshopt
```

Gli oggetti animati dal sito hanno un nome fisso (`Guest_A`, `Facade_F0`, `Elev0_DoorL`, `QR_Stand`, `Phone`, ...):
se si rinominano in Blender vanno aggiornati in `src/story.js` / `src/three/Hotel.jsx`.

## Codice

- `src/story.js` – **tutta la regia**: keyframe della camera, percorsi dei personaggi, porte, giorno/notte,
  bolle, chat. Le coordinate sono in spazio Blender (Z in alto), convertite con `B()`.
- `src/three/` – scena React Three Fiber (hotel, logo, ticket, schermo del telefono, luci, cielo, bloom)
- `src/ui/` – overlay HTML (hero, didascalie, bacheca staff, sezioni finali, logo SVG)

Stack: Vite · React 19 · three.js · @react-three/fiber + drei + postprocessing · Lenis.

## Deploy su Vercel

Importa la repo su Vercel: il preset Vite viene rilevato da solo (build `npm run build`, output `dist`,
configurati anche in `vercel.json`). Nessuna variabile d'ambiente necessaria.
Colori, font (Ubuntu) e testi presi da consergio.ai.
