/** Resorts the forecast row covers. Points are mid-mountain, elevation in metres (Open-Meteo downscales to it). */
export type Resort = { id: string; name: string; region: string; lat: number; lon: number; elevation: number }

export const RESORTS: Resort[] = [
  { id: 'baqueira', name: 'Baqueira-Beret', region: 'Catalan Pyrenees', lat: 42.7, lon: 0.93, elevation: 2000 },
  { id: 'la-molina', name: 'La Molina / Masella', region: 'Catalan Pyrenees', lat: 42.33, lon: 1.94, elevation: 1900 },
  { id: 'grandvalira', name: 'Grandvalira', region: 'Andorra', lat: 42.54, lon: 1.73, elevation: 2200 },
  { id: 'pal-arinsal', name: 'Pal Arinsal', region: 'Andorra', lat: 42.56, lon: 1.48, elevation: 2000 },
  { id: 'formigal', name: 'Formigal', region: 'Aragon', lat: 42.78, lon: -0.36, elevation: 1900 },
  { id: 'cerler', name: 'Cerler', region: 'Aragon', lat: 42.56, lon: 0.55, elevation: 2000 },
  { id: 'sierra-nevada', name: 'Sierra Nevada', region: 'Andalusia', lat: 37.09, lon: -3.39, elevation: 2500 },
]
