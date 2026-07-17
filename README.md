# Ranum Summer School Poker 🃏

Turneringsstyring til pokerturneringen på Ranum Summer School — uden database,
klar til Vercel.

## Sådan bruges det

1. **Kontrolpanelet** ligger på forsiden (`/`). Herfra styrer du alt:
   - **Deltagere**: indsæt navne (ét pr. linje) eller upload en `.txt`/`.csv`-fil.
   - **Borde**: opret borde med navn og antal pladser, og tryk
     *“🎲 Fordel pladser tilfældigt”* for at trække pladser til alle.
   - **Ude**: når en spiller ryger ud, tryk *“Ude”* — placeringen registreres
     automatisk (første der ryger ud får sidstepladsen). *“Fortryd”* hvis du
     kom til at trykke forkert.
   - **Blinds**: uret tæller ned og hæver selv blinds ved niveauskift. Du kan
     også skifte manuelt med *“Næste niveau”* og redigere hele strukturen.
2. **Storskærmen** åbnes med knappen *“Åbn storskærm ↗”* (eller gå til
   `/display`). Træk vinduet over på storskærmen/projektoren og tryk `F11`
   for fuld skærm. Den opdaterer live, mens du styrer fra kontrolpanelet.
3. **Resultat-filmen**: når turneringen er slut, tryk
   *“🎬 Vis resultat-film på storskærm”* — placeringerne afsløres én ad
   gangen fra sidstepladsen, og til sidst vises podiet med top 3 og konfetti.

> **Vigtigt:** Der er ingen database. Tilstanden gemmes i browserens
> localStorage og synkroniseres live mellem faner/vinduer i **samme browser
> på samme computer**. Kør derfor både kontrolpanel og storskærm fra den
> computer, der er koblet til storskærmen. Data overlever genindlæsning af
> siden.

## Fast opsætning i koden

Standard-opsætningen ligger i [`data/config.ts`](data/config.ts):
turneringens navn, faste deltagere, faste borde og blind-strukturen.
Ret filen og deploy igen, hvis du vil have det hele klar på forhånd.

## Kør lokalt

```bash
npm install
npm run dev
```

Åbn http://localhost:3000

## Deploy til Vercel

Importér repoet på [vercel.com](https://vercel.com) — det er en standard
Next.js-app, så der skal ikke sættes noget op. Ingen miljøvariabler, ingen
database.
