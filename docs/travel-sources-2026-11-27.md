# Travel times: sources (checked 2026-11-27)

The bus and train legs in `src/config/resorts.ts` were checked against official pages for winter 2026–27.
Few operators publish a through timetable. Legs with no official figure are marked `checked: 'estimate'` and show `≈` on the Resorts tab.
Legs that run only in season or on some days carry `runs`.

| Resort | Leg | Minutes | Checked | Source |
|---|---|---|---|---|
| Baqueira | Bus | 280 (was 345) | official | baqueira.es/es/como-llegar, "Bus directo 4h 40m": Alsa to Vielha, then local line VA |
| Baqueira | Train | 237 (was 350) | official | same page, "Tren + Transfer 3h 57m": train to Lleida, then bus via Vielha |
| La Molina | Bus | 140 | estimate, seasonal | sagales.com trips 68 and 141: SkiBus 19 Dec 2026–4 Apr 2027. Sat/Sun from Sants bus station 06:00 or Nord 06:30; Wed/Fri from Nord 06:30. No bus 25 Dec, 1 Jan or 6 Jan. Returns 16:00. €68 with the ski pass. Arrival time not published |
| La Molina | Train | 200 (was 180, direct) | estimate | rodalies.gencat.cat: the timetable search gives "Horario no disponible". Scheduled works notice: rail runs La Garriga–Puigcerdà, with a road service Fabra i Puig–La Garriga. The pre-works direct train took 2h22 |
| Grandvalira | Bus | 210 | estimate | andbus.ad/es/horarios-y-tarifas: Barcelona Diagonal 07:15, then every 2 h; 2h45 to Andorra la Vella. No Soldeu time published |
| Pal Arinsal | Bus | 210 | estimate | Andbus as above, plus national lines L5 and L6 (palarinsal.com, how to get here). No L5/L6 times found |
| Formigal | Bus | 440 | estimate | Rome2rio only: Avanza via Huesca, 7h22. Avanza and aramon.com have no readable timetable |
| Formigal | Train | 360 | estimate | Rome2rio only: AVE to Zaragoza, then Avanza (about 2 a day), 5h59 |
| Cerler | Bus | 385 | estimate | Rome2rio only: Avanza to Barbastro, then Monbus to Benasque. The Benasque–Cerler bus runs Mon–Fri in season (travel guide) |
| Cerler | Train | 360 | estimate | Rome2rio only: AVE to Lleida, bus to Barbastro, then on to Benasque, about 6h07 |
| Sierra Nevada | Bus | 890 | estimate | Alsa coach about 12h45 (Movelia). Tocina bus up from autotransportetocina.es/sierra-nevada2 (official, undated): Granada 08:00, 10:15 and 17:15, plus 15:00 at weekends |
| Sierra Nevada | Train | 585 (was 450) | estimate | AVE 08:30 Sants to 15:38 Granada (Omio snapshot), then the 17:15 Tocina bus up. The old 450 counted the train only |

## Car

The resort pages give no driving time from Barcelona, except Baqueira's. For the other resorts the time is the average of two routing engines (OSRM and Valhalla, OpenStreetMap data), rounded to 5 min. The trip runs from Plaça de Catalunya to the base station. These are free-flow times: add time for traffic, snow and chains.

| Resort | km | min | Was | OSRM | Valhalla |
|---|---|---|---|---|---|
| Baqueira | 320 | 266 | 230 | 282 km / 241 min | 291 km / 241 min |
| La Molina | 155 | 120 | 110 | 150 / 121 | 158 / 121 |
| Grandvalira (Soldeu) | 195 | 170 | 160 | 192 / 167 | 200 / 168 |
| Pal Arinsal | 200 | 175 | 160 | 202 / 176 | 225 / 209 |
| Formigal | 350 (was 400) | 255 | 255 | 350 / 262 | 355 / 246 |
| Cerler | 305 | 250 | 230 | 301 / 256 | 307 / 244 |
| Sierra Nevada | 875 | 580 | 525 | 864 / 601 | 889 / 554 |

Baqueira's figure is from baqueira.es ("Coche 4h 26m", via Lleida, the A-14, the N-230 and the Vielha tunnel). Both engines route over the Port de la Bonaigua (C-13/C-28), which often closes in winter, so the resort's figure stays. Pal Arinsal uses OSRM: its route via the Cadí tunnel and La Seu is the usual one, and Valhalla took a longer road.

Flight Barcelona–Granada: Vueling nonstop, 1h35–1h40. The note stays.

## Still to check

These sites block automated fetches or only offer a search form. Open them in a browser once the 2026–27 timetables are out:

- alsa.com: Barcelona–Vielha, Barcelona–Benasque, Barcelona–Granada.
- avanzabus.com: Barcelona–Huesca/Barbastro, Zaragoza–Formigal.
- renfe.com: Sants–Granada, Sants–Lleida.
- conselharan.org: line VA.
- mobilitat.ad: L5/L6 PDF.
- Sagalés: SkiBus arrival time.
