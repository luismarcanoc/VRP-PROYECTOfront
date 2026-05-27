# VRP-PROYECTOfront

Frontend de visualizacion y ajuste de rutas.

## Configuracion de API

En `script.js` existe:

- `window.VRP_API_BASE` (para inyectar la URL publica del backend desde HTML)
- `?api=https://tu-backend.example.com/api` (sobrescribe la URL y la guarda localmente)
- fallback productivo: `https://vrp-proyectoback.onrender.com/api`
- fallback local: `http://localhost:10000/api`

La variable `DATABASE_URL` y cualquier `ADMIN_KEY` pertenecen solo al backend. Nunca deben configurarse ni publicarse en este frontend.

## Flujo

- Frontend consume endpoints HTTP del backend desplegado.
- Backend lee/escribe datos en la base PostgreSQL central.
- Optimizacion usa Google Maps desde backend.
- En dispositivos moviles se abre la hoja del conductor: grafo, exportacion a Maps, listado de clientes y confirmacion de entregas.
- Para probar esa vista desde escritorio durante desarrollo, agrega `?mobile=1` a la URL.

Si cambia el dominio publico del servicio backend, actualiza `REMOTE_API_BASE` en `script.js`
o configura `window.VRP_API_BASE` antes de cargar `script.js`.
