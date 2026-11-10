# Gimcana Fotogràfica

Aplicació web per a una gimcana de fotos entre dos equips (A i B) i un monitor.
Els equips fan fotos dels reptes i el monitor les aprova o les rebutja. Cada
repte aprovat afegeix temps al rellotge de l'equip.

## Estructura

```
src/
  App.tsx            Tria entre l'inici, el monitor i els equips
  main.tsx           Arrencada de React i estils
  types.ts           Tipus compartits
  hooks/             Lògica: dades del servidor, consulta cada 5 s, rellotges
  lib/               Supabase, crides a les Edge Functions, format, fotos
  screens/
    common/          Inici i peces comunes
    team/            Pantalles dels equips
    monitor/         Pantalles del monitor
  styles/            Estils per zones
supabase/
  config.toml        Configuració de la CLI i de les funcions
  schema.sql         Estructura de la base de dades (referència)
  functions/
    _shared/         Codi comú de les funcions
    <nom>/index.ts   Una carpeta per funció
docs/                Document de context del projecte
```

## Ordres (PowerShell)

```powershell
npm.cmd install                 # instal·lar dependències
npm.cmd run dev                 # provar en local
npm.cmd run dev -- --host       # provar des del mòbil (mateix wifi)
npm.cmd run build               # compilar
npx.cmd supabase functions deploy <nom>   # publicar una Edge Function
```

Les variables `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY` van a
`.env.local` (no es puja a Git). Cada `git push` a `main` publica l'app a Vercel.
