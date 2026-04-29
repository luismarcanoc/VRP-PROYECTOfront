# VRP-PROYECTOfront

Frontend de visualizacion y ajuste de rutas.

## Configuracion de API

En `script.js` existe:

- `window.VRP_API_BASE` (si quieres inyectarlo desde HTML)
- fallback: `https://TU-BACKEND.onrender.com/api`

Debes reemplazar `TU-BACKEND` por tu servicio real en Render.

## Flujo

- Frontend consume endpoints del backend en Render.
- Backend lee/escribe datos en Neon.
- Optimizacion usa Google Maps desde backend.
