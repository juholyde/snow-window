/** Resorts the forecast and Resorts tab cover. Points are mid-mountain, elevation in metres (Open-Meteo downscales to it). */
export type Webcam = { label: string; url: string }
export type Area = 'spain' | 'alps' | 'finland' | 'sweden'
export const AREAS: { id: Area; label: string }[] = [
  { id: 'spain', label: 'Spain & Andorra' },
  { id: 'alps', label: 'Alps' },
  { id: 'finland', label: 'Finland' },
  { id: 'sweden', label: 'Sweden' },
]
export type Resort = {
  id: string
  name: string
  area: Area
  /** Sub-region label shown on the card. */
  region: string
  lat: number
  lon: number
  elevation: number
  /** The resort's own live webcam pages first, then an archive. Checked 2026-11-25. */
  webcams: Webcam[]
  /** A freely licensed photo from Wikimedia Commons, stored in public/resorts/, credited on the card. */
  photo: Photo
  /** Getting there from central Barcelona. Car, bus and train checked 2026-11-27; sources in docs/travel-sources-2026-11-27.md. Only the Spanish and Andorran resorts have it. */
  travel?: Travel
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
    area: 'spain',
    region: 'Catalan Pyrenees',
    lat: 42.7,
    lon: 0.93,
    elevation: 2000,
    photo: commons('baqueira.jpg', 'Cantabrucu', 'CC0', 'Baqueira-Beret_16.jpg'),
    travel: { car: { km: 320, minutes: 266, route: 'A-2 to Lleida, then N-230 via Benabarre and the Vielha tunnel' }, bus: { minutes: 280, kind: 'change', route: 'Alsa to Vielha, then local line VA to Baqueira', checked: 'official' }, train: { minutes: 237, kind: 'change', route: 'Train to Lleida, then bus via Vielha to Baqueira', checked: 'official' } },
    webcams: [{ label: 'Live webcams', url: 'https://www.baqueira.es/es/webcams' }, archive('baqueira-beret')],
  },
  {
    id: 'la-molina',
    name: 'La Molina / Masella',
    area: 'spain',
    region: 'Catalan Pyrenees',
    lat: 42.33,
    lon: 1.94,
    elevation: 1900,
    photo: commons('la-molina.jpg', 'Antonio De Lorenzo', 'CC BY 2.5', 'Molina_La2.JPG'),
    travel: { car: { km: 155, minutes: 120, route: 'C-16 through the Cadí tunnel' }, bus: { minutes: 140, kind: 'direct', route: 'Sagalés SkiBus, ski pass included: Sants 06:00 at weekends, Nord 06:30 on Wed and Fri; back 16:00', checked: 'estimate', runs: '19 Dec–4 Apr, Wed, Fri, Sat, Sun' }, train: { minutes: 200, kind: 'change', route: 'R3 works: replacement bus Fabra i Puig–La Garriga, then train to La Molina and the shuttle up. No through timetable published', checked: 'estimate' } },
    webcams: [
      { label: 'La Molina webcams', url: 'https://pirineu365.cat/es/lamolina/en-directo/webcams/' },
      { label: 'Masella webcams', url: 'https://www.masella.com/ca/webcam' },
      archive('la-molina-masella-alp2500'),
    ],
  },
  {
    id: 'grandvalira',
    name: 'Grandvalira',
    area: 'spain',
    region: 'Andorra',
    lat: 42.54,
    lon: 1.73,
    elevation: 2200,
    photo: commons('grandvalira.jpg', 'Carlos Delgado', 'CC BY-SA 3.0', 'Pas_de_la_Casa-Hivern.jpg'),
    travel: { car: { km: 195, minutes: 170, route: 'C-16 and Puigcerdà, or via La Seu d\'Urgell' }, bus: { minutes: 210, kind: 'direct', route: 'Andbus Barcelona–Soldeu (every 2 h to Andorra la Vella, 2h45 from Diagonal)', checked: 'estimate' }, train: null },
    webcams: [
      { label: 'Live webcams', url: 'https://www.grandvalira.com/es/estacion/webcams' },
      archive('grandvalira-pas-de-la-casa-grau-roig-soldeu-el-tarter-canillo-encamp'),
    ],
  },
  {
    id: 'pal-arinsal',
    name: 'Pal Arinsal',
    area: 'spain',
    region: 'Andorra',
    lat: 42.56,
    lon: 1.48,
    elevation: 2000,
    photo: commons('pal-arinsal.jpg', 'Pal Arinsal / Martin Imatge', 'CC BY-SA 4.0', '2020_01_24_Copa_del_M%C3%B3n_Esqui_Muntanya_(Martin_Imatge)-0942.jpg'),
    travel: { car: { km: 200, minutes: 175, route: 'C-16 through the Cadí tunnel, then N-260 via La Seu d\'Urgell' }, bus: { minutes: 210, kind: 'change', route: 'Andbus to Andorra la Vella (2h45, every 2 h), then line L5 or L6', checked: 'estimate' }, train: null },
    webcams: [
      { label: 'Live webcams', url: 'https://www.palarinsal.com/es/estacion/webcams' },
      archive('pal-arinsal-la-massana'),
    ],
  },
  {
    id: 'formigal',
    name: 'Formigal',
    area: 'spain',
    region: 'Aragon',
    lat: 42.78,
    lon: -0.36,
    elevation: 1900,
    photo: commons('formigal.jpg', 'Willtron', 'CC BY-SA 3.0', 'Vista_de_la_estaci%C3%B3n_de_esqu%C3%AD_de_Formigal_desde_la_pista_del_Collado.jpg'),
    travel: { car: { km: 350, minutes: 255, route: 'Via Lleida, Huesca and Sabiñánigo' }, bus: { minutes: 440, kind: 'change', route: 'Avanza via Huesca; about 2 buses a day up to Formigal', checked: 'estimate' }, train: { minutes: 360, kind: 'change', route: 'AVE to Zaragoza, then Avanza bus (about 2 a day)', checked: 'estimate' } },
    webcams: [
      { label: 'Live webcams', url: 'https://www.aramon.com/formigal-panticosa/webcam-formigal-panticosa.html' },
      archive('formigal'),
    ],
  },
  {
    id: 'cerler',
    name: 'Cerler',
    area: 'spain',
    region: 'Aragon',
    lat: 42.56,
    lon: 0.55,
    elevation: 2000,
    photo: commons('cerler.jpg', 'total 13', 'CC BY 2.0', 'Cerler,_telesilla.jpg'),
    travel: { car: { km: 305, minutes: 250, route: 'Via Lleida, Barbastro and Benasque' }, bus: { minutes: 385, kind: 'change', route: 'Via Barbastro and Benasque; few buses a day', checked: 'estimate', runs: 'Benasque–Cerler bus Mon–Fri in season' }, train: { minutes: 360, kind: 'change', route: 'Train to Lleida, then bus via Barbastro to Benasque', checked: 'estimate', runs: 'Benasque–Cerler bus Mon–Fri in season' } },
    webcams: [{ label: 'Live webcams', url: 'https://www.aramon.com/cerler/webcam-cerler.html' }, archive('cerler')],
  },
  {
    id: 'sierra-nevada',
    name: 'Sierra Nevada',
    area: 'spain',
    region: 'Andalusia',
    lat: 37.09,
    lon: -3.39,
    elevation: 2500,
    photo: commons('sierra-nevada.jpg', 'Emilio J. Rodríguez Posada', 'CC BY-SA 3.0', 'Sierra_Nevada_Espa%C3%B1a_(Spain)_10.JPG'),
    travel: { car: { km: 875, minutes: 580, route: 'Along the coast to Granada, then A-395' }, bus: { minutes: 890, kind: 'change', route: 'Alsa to Granada (about 12h45), then the Tocina bus up (08:00, 10:15, 17:15; 15:00 too at weekends)', checked: 'estimate' }, train: { minutes: 585, kind: 'change', route: 'AVE 08:30 to Granada (15:38), then the 17:15 Tocina bus up', checked: 'estimate' }, note: 'Fastest: fly to Granada (1h35) and take the bus up' },
    webcams: [
      { label: 'Live webcams', url: 'https://sierranevada.es/en/invierno/the-station/live/webcams/' },
      archive('sierra-nevada-pradollano'),
    ],
  },
  {
    id: 'chamonix',
    name: 'Chamonix',
    area: 'alps',
    region: 'Haute-Savoie, France',
    lat: 45.95,
    lon: 6.85,
    elevation: 1900,
    photo: commons('chamonix.jpg', 'eGuide Travel', 'CC BY 2.0', 'Chamonix_winter_(6743888531).jpg'),
    webcams: [
      { label: 'Live webcams', url: 'https://www.chamonix.com/webcams' },
      archive('brevent-flegere-chamonix')
    ],
  },
  {
    id: 'val-thorens',
    name: 'Val Thorens',
    area: 'alps',
    region: 'Savoie, France',
    lat: 45.3,
    lon: 6.58,
    elevation: 2600,
    photo: commons('val-thorens.jpg', 'Florian Pépellin', 'CC BY-SA 4.0', 'Jonction_des_pistes_de_ski_à_Val_Thorens_(hiver_2019).JPG'),
    webcams: [
      { label: 'Live webcams', url: 'https://www.valthorens.com/en/webcams/' },
      archive('les-3-vallees-val-thorens-les-menuires-meribel-courchevel')
    ],
  },
  {
    id: 'tignes',
    name: 'Tignes / Val d\'Isère',
    area: 'alps',
    region: 'Savoie, France',
    lat: 45.46,
    lon: 6.91,
    elevation: 2300,
    photo: commons('tignes.jpg', 'Tonkie', 'CC BY-SA 3.0', 'Tignes-winter.JPG'),
    webcams: [
      { label: 'Tignes webcams', url: 'https://www.tignes.net/webcams' },
      { label: 'Val d\'Isère webcams', url: 'https://www.valdisere.com/live/webcams/' },
      archive('tignes-val-disere')
    ],
  },
  {
    id: 'zermatt',
    name: 'Zermatt',
    area: 'alps',
    region: 'Valais, Switzerland',
    lat: 46.01,
    lon: 7.77,
    elevation: 2500,
    photo: commons('zermatt.jpg', 'Deralpinbergsteiger', 'CC BY-SA 4.0', 'Matterhorn_in_winter_with_Zermatt_village.jpg'),
    webcams: [
      { label: 'Live webcams', url: 'https://zermatt.swiss/en/info/webcams' },
      archive('zermatt-breuil-cervinia-valtournenche-matterhorn')
    ],
  },
  {
    id: 'verbier',
    name: 'Verbier',
    area: 'alps',
    region: 'Valais, Switzerland',
    lat: 46.1,
    lon: 7.23,
    elevation: 2200,
    photo: commons('verbier.jpg', 'Realleok', 'CC BY-SA 4.0', 'Ski_Slopes_of_Verbier.jpg'),
    webcams: [
      { label: 'Live webcams', url: 'https://www.verbier.ch/pratique/live/webcams/' },
      archive('4-vallees-verbier-la-tzoumaz-nendaz-veysonnaz-thyon')
    ],
  },
  {
    id: 'st-anton',
    name: 'St. Anton am Arlberg',
    area: 'alps',
    region: 'Tyrol, Austria',
    lat: 47.13,
    lon: 10.24,
    elevation: 2000,
    photo: commons('st-anton.jpg', 'Johnfmh at English Wikipedia', 'Public domain', 'STANTON2.jpg'),
    webcams: [
      { label: 'Live webcams', url: 'https://www.stantonamarlberg.com/en/webcams' },
      archive('st-anton-st-christoph-stuben-lech-zuers-warth-schroecken-ski-arlberg')
    ],
  },
  {
    id: 'kitzbuehel',
    name: 'Kitzbühel',
    area: 'alps',
    region: 'Tyrol, Austria',
    lat: 47.41,
    lon: 12.39,
    elevation: 1600,
    photo: commons('kitzbuehel.jpg', 'Valerii Tkachenko', 'CC BY 2.0', 'Winter_snow_in_Kitzbühel.jpg'),
    webcams: [
      { label: 'Live webcams', url: 'https://www.kitzbuehel.com/en/live/' },
      archive('kitzski-kitzbuehel-kirchberg')
    ],
  },
  {
    id: 'cervinia',
    name: 'Breuil-Cervinia',
    area: 'alps',
    region: 'Aosta Valley, Italy',
    lat: 45.93,
    lon: 7.65,
    elevation: 2400,
    photo: commons('cervinia.jpg', 'Cosmo F Kramer', 'CC BY 2.0', 'After_one_day_of_snowfall,_Cervinia,_Italy_(27834665829).jpg'),
    webcams: [
      { label: 'Live webcams', url: 'https://www.cervinia.it/en/webcam/' },
      archive('zermatt-breuil-cervinia-valtournenche-matterhorn')
    ],
  },
  {
    id: 'levi',
    name: 'Levi',
    area: 'finland',
    region: 'Lapland, Finland',
    lat: 67.8,
    lon: 24.81,
    elevation: 400,
    photo: commons('levi.jpg', 'DanielMichaelPerry', 'CC0', 'Levi_North_Ski_Slope_and_Lift.jpg'),
    webcams: [
      archive('levi')
    ],
  },
  {
    id: 'yllas',
    name: 'Ylläs',
    area: 'finland',
    region: 'Lapland, Finland',
    lat: 67.57,
    lon: 24.17,
    elevation: 550,
    photo: commons('yllas.jpg', 'Estormiz', 'Public domain', 'Yllastunturi_20090301.JPG'),
    webcams: [
      { label: 'Weather and webcams', url: 'https://yllas.fi/info/saa/' },
      archive('yllaes')
    ],
  },
  {
    id: 'ruka',
    name: 'Ruka',
    area: 'finland',
    region: 'Kuusamo, Finland',
    lat: 66.17,
    lon: 29.15,
    elevation: 350,
    photo: commons('ruka.jpg', 'VynedJ', 'CC BY 4.0', 'Ruka_Masto_Express_top_station_side_view_20260219.jpg'),
    webcams: [
      { label: 'Live webcams', url: 'https://www.ruka.fi/en/webcams' },
      archive('ruka')
    ],
  },
  {
    id: 'pyha',
    name: 'Pyhä',
    area: 'finland',
    region: 'Lapland, Finland',
    lat: 67.01,
    lon: 27.19,
    elevation: 400,
    photo: commons('pyha.jpg', 'Trainthh', 'CC BY-SA 3.0', 'Pyhatunturi.JPG'),
    webcams: [
      { label: 'Live webcams', url: 'https://www.pyha.fi/en/webcameras' },
      archive('pyhae')
    ],
  },
  {
    id: 'saariselka',
    name: 'Saariselkä',
    area: 'finland',
    region: 'Lapland, Finland',
    lat: 68.41,
    lon: 27.41,
    elevation: 350,
    photo: commons('saariselka.jpg', 'Ninara', 'CC BY 2.0', 'Y1A9749_Saariselkä,_Finland_(15186395524).jpg'),
    webcams: [
      { label: 'Live webcams', url: 'https://laplandnorth.fi/en/web-cameras/' },
      archive('saariselkae')
    ],
  },
  {
    id: 'are',
    name: 'Åre',
    area: 'sweden',
    region: 'Jämtland, Sweden',
    lat: 63.4,
    lon: 13.08,
    elevation: 700,
    photo: commons('are.jpg', 'Anders Carlsson', 'CC BY 2.0', 'Snowy_Åreskutan_Ski_lift.jpg'),
    webcams: [
      { label: 'Live webcams', url: 'https://www.skistar.com/en/ski-destinations/are/winter-in-are/weather-and-slopes/webcams-are/' }
    ],
  },
  {
    id: 'salen',
    name: 'Sälen',
    area: 'sweden',
    region: 'Dalarna, Sweden',
    lat: 61.16,
    lon: 13.0,
    elevation: 600,
    photo: commons('salen.jpg', 'jag', 'Public domain', 'Tandådalen_Ski.jpg'),
    webcams: [
      { label: 'Live webcams', url: 'https://www.skistar.com/en/ski-destinations/salen/winter-in-salen/weather-slopes/webcams-salen/' }
    ],
  },
  {
    id: 'vemdalen',
    name: 'Vemdalen',
    area: 'sweden',
    region: 'Jämtland, Sweden',
    lat: 62.45,
    lon: 13.86,
    elevation: 750,
    photo: commons('vemdalen.jpg', 'Pieter Kuiper', 'Public domain', 'Vemdalsskalt_barnbackarna.JPG'),
    webcams: [
      { label: 'Live webcams', url: 'https://www.skistar.com/en/ski-destinations/vemdalen/winter-in-vemdalen/weather-and-slopes/webcams-vemdalen/' }
    ],
  },
  {
    id: 'riksgransen',
    name: 'Riksgränsen',
    area: 'sweden',
    region: 'Norrbotten, Sweden',
    lat: 68.43,
    lon: 18.12,
    elevation: 600,
    photo: commons('riksgransen.jpg', 'BIL', 'CC BY-SA 4.0', 'Riksgränsen_20220313_161205.jpg'),
    webcams: [
      { label: 'Webcams (third party)', url: 'https://webcamcollections.com/countries/sweden/riksgransen' }
    ],
  },
  {
    id: 'idre-fjall',
    name: 'Idre Fjäll',
    area: 'sweden',
    region: 'Dalarna, Sweden',
    lat: 61.89,
    lon: 12.85,
    elevation: 800,
    photo: commons('idre-fjall.jpg', 'René Bongard', 'CC BY-SA 3.0', 'Skiing_at_Idre_Fjäll_-_panoramio_(2).jpg'),
    webcams: [
      { label: 'Live webcams', url: 'https://www.idrefjall.se/en/webcams/' },
      archive('idre-fjaell')
    ],
  },
]
