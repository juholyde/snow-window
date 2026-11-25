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
}

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
    webcams: [{ label: 'Live webcams', url: 'https://www.baqueira.es/es/webcams' }, archive('baqueira-beret')],
  },
  {
    id: 'la-molina',
    name: 'La Molina / Masella',
    region: 'Catalan Pyrenees',
    lat: 42.33,
    lon: 1.94,
    elevation: 1900,
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
    webcams: [{ label: 'Live webcams', url: 'https://www.aramon.com/cerler/webcam-cerler.html' }, archive('cerler')],
  },
  {
    id: 'sierra-nevada',
    name: 'Sierra Nevada',
    region: 'Andalusia',
    lat: 37.09,
    lon: -3.39,
    elevation: 2500,
    webcams: [
      { label: 'Live webcams', url: 'https://sierranevada.es/en/invierno/the-station/live/webcams/' },
      archive('sierra-nevada-pradollano'),
    ],
  },
]
