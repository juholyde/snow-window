/** Resorts the forecast and Resorts tab cover. Points are mid-mountain, elevation in metres (Open-Meteo downscales to it). */
export type Webcam = { label: string; url: string }
export type Resort = {
  id: string
  name: string
  region: string
  lat: number
  lon: number
  elevation: number
  /** The resort's own live webcam pages first, then an archive. Checked 2026-11-25. */
  webcams: Webcam[]
  /** A freely licensed photo from Wikimedia Commons, stored in public/resorts/, credited on the card. */
  photo: Photo
  /** Getting there from central Barcelona. Bus and train legs checked 2026-11-27; sources in docs/travel-sources-2026-11-27.md. */
  travel: Travel
}
/**
 * 'direct' = one vehicle (maybe a short shuttle at the end); 'change' = at least one change.
 * checked: 'official' when an operator or the resort publishes the time; 'estimate' when no
 * 2026-27 timetable could be found (aggregators, or official parts plus a guess).
 * runs: set when the service is seasonal or runs on some days only.
 */
export type Leg = {
  minutes: number
  kind: 'direct' | 'change'
  route: string
  checked: 'official' | 'estimate'
  runs?: string
} | null
export type Travel = { car: { km: number; minutes: number; route: string }; bus: Leg; train: Leg; note?: string }
export type Photo = { file: string; author: string; license: string; source: string }

const commons = (file: string, author: string, license: string, page: string): Photo => ({
  file: `resorts/${file}`,
  author,
  license,
  source: `https://commons.wikimedia.org/wiki/File:${page}`,
})

const archive = (slug: string): Webcam => ({
  label: 'Webcam archive',
  url: `https://www.skiresort.com/en/ski-resort/${slug}/webcams/`,
})

export const RESORTS: Resort[] = [
  {
    id: 'baqueira',
    name: 'Baqueira-Beret',
    region: 'Catalan Pyrenees',
    lat: 42.7,
    lon: 0.93,
    elevation: 2000,
    photo: commons('baqueira.jpg', 'Cantabrucu', 'CC0', 'Baqueira-Beret_16.jpg'),
    travel: { car: { km: 320, minutes: 230, route: 'Via Lleida and the Vielha tunnel' }, bus: { minutes: 280, kind: 'change', route: 'Alsa to Vielha, then local line VA to Baqueira', checked: 'official' }, train: { minutes: 237, kind: 'change', route: 'Train to Lleida, then bus via Vielha to Baqueira', checked: 'official' } },
    webcams: [{ label: 'Live webcams', url: 'https://www.baqueira.es/es/webcams' }, archive('baqueira-beret')],
  },
  {
    id: 'la-molina',
    name: 'La Molina / Masella',
    region: 'Catalan Pyrenees',
    lat: 42.33,
    lon: 1.94,
    elevation: 1900,
    photo: commons('la-molina.jpg', 'Antonio De Lorenzo', 'CC BY 2.5', 'Molina_La2.JPG'),
    travel: { car: { km: 150, minutes: 110, route: 'C-16 through the Cadí tunnel' }, bus: { minutes: 140, kind: 'direct', route: 'Sagalés SkiBus, ski pass included: Sants 06:00 at weekends, Nord 06:30 on Wed and Fri; back 16:00', checked: 'estimate', runs: '19 Dec–4 Apr, Wed, Fri, Sat, Sun' }, train: { minutes: 200, kind: 'change', route: 'R3 works: replacement bus Fabra i Puig–La Garriga, then train to La Molina and the shuttle up. No through timetable published', checked: 'estimate' } },
    webcams: [
      { label: 'La Molina webcams', url: 'https://pirineu365.cat/es/lamolina/en-directo/webcams/' },
      { label: 'Masella webcams', url: 'https://www.masella.com/ca/webcam' },
      archive('la-molina-masella-alp2500'),
    ],
  },
  {
    id: 'grandvalira',
    name: 'Grandvalira',
    region: 'Andorra',
    lat: 42.54,
    lon: 1.73,
    elevation: 2200,
    photo: commons('grandvalira.jpg', 'Carlos Delgado', 'CC BY-SA 3.0', 'Pas_de_la_Casa-Hivern.jpg'),
    travel: { car: { km: 190, minutes: 160, route: 'C-16 and Puigcerdà, or via La Seu d\'Urgell' }, bus: { minutes: 210, kind: 'direct', route: 'Andbus Barcelona–Soldeu (every 2 h to Andorra la Vella, 2h45 from Diagonal)', checked: 'estimate' }, train: null },
    webcams: [
      { label: 'Live webcams', url: 'https://www.grandvalira.com/es/estacion/webcams' },
      archive('grandvalira-pas-de-la-casa-grau-roig-soldeu-el-tarter-canillo-encamp'),
    ],
  },
  {
    id: 'pal-arinsal',
    name: 'Pal Arinsal',
    region: 'Andorra',
    lat: 42.56,
    lon: 1.48,
    elevation: 2000,
    photo: commons('pal-arinsal.jpg', 'Pal Arinsal / Martin Imatge', 'CC BY-SA 4.0', '2020_01_24_Copa_del_M%C3%B3n_Esqui_Muntanya_(Martin_Imatge)-0942.jpg'),
    travel: { car: { km: 200, minutes: 160, route: 'C-14 via La Seu d\'Urgell' }, bus: { minutes: 210, kind: 'change', route: 'Andbus to Andorra la Vella (2h45, every 2 h), then line L5 or L6', checked: 'estimate' }, train: null },
    webcams: [
      { label: 'Live webcams', url: 'https://www.palarinsal.com/es/estacion/webcams' },
      archive('pal-arinsal-la-massana'),
    ],
  },
  {
    id: 'formigal',
    name: 'Formigal',
    region: 'Aragon',
    lat: 42.78,
    lon: -0.36,
    elevation: 1900,
    photo: commons('formigal.jpg', 'Willtron', 'CC BY-SA 3.0', 'Vista_de_la_estaci%C3%B3n_de_esqu%C3%AD_de_Formigal_desde_la_pista_del_Collado.jpg'),
    travel: { car: { km: 400, minutes: 255, route: 'Via Lleida, Huesca and Sabiñánigo' }, bus: { minutes: 440, kind: 'change', route: 'Avanza via Huesca; about 2 buses a day up to Formigal', checked: 'estimate' }, train: { minutes: 360, kind: 'change', route: 'AVE to Zaragoza, then Avanza bus (about 2 a day)', checked: 'estimate' } },
    webcams: [
      { label: 'Live webcams', url: 'https://www.aramon.com/formigal-panticosa/webcam-formigal-panticosa.html' },
      archive('formigal'),
    ],
  },
  {
    id: 'cerler',
    name: 'Cerler',
    region: 'Aragon',
    lat: 42.56,
    lon: 0.55,
    elevation: 2000,
    photo: commons('cerler.jpg', 'total 13', 'CC BY 2.0', 'Cerler,_telesilla.jpg'),
    travel: { car: { km: 300, minutes: 230, route: 'Via Lleida, Barbastro and Benasque' }, bus: { minutes: 385, kind: 'change', route: 'Via Barbastro and Benasque; few buses a day', checked: 'estimate', runs: 'Benasque–Cerler bus Mon–Fri in season' }, train: { minutes: 360, kind: 'change', route: 'Train to Lleida, then bus via Barbastro to Benasque', checked: 'estimate', runs: 'Benasque–Cerler bus Mon–Fri in season' } },
    webcams: [{ label: 'Live webcams', url: 'https://www.aramon.com/cerler/webcam-cerler.html' }, archive('cerler')],
  },
  {
    id: 'sierra-nevada',
    name: 'Sierra Nevada',
    region: 'Andalusia',
    lat: 37.09,
    lon: -3.39,
    elevation: 2500,
    photo: commons('sierra-nevada.jpg', 'Emilio J. Rodríguez Posada', 'CC BY-SA 3.0', 'Sierra_Nevada_Espa%C3%B1a_(Spain)_10.JPG'),
    travel: { car: { km: 860, minutes: 525, route: 'Along the coast to Granada, then A-395' }, bus: { minutes: 890, kind: 'change', route: 'Alsa to Granada (about 12h45), then the Tocina bus up (08:00, 10:15, 17:15; 15:00 too at weekends)', checked: 'estimate' }, train: { minutes: 585, kind: 'change', route: 'AVE 08:30 to Granada (15:38), then the 17:15 Tocina bus up', checked: 'estimate' }, note: 'Fastest: fly to Granada (1h35) and take the bus up' },
    webcams: [
      { label: 'Live webcams', url: 'https://sierranevada.es/en/invierno/the-station/live/webcams/' },
      archive('sierra-nevada-pradollano'),
    ],
  },
]
