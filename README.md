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
- El modulo de errores incluye direcciones que Google Maps no encuentra con seguridad para corregirlas antes de despachar.
- En dispositivos moviles se abre la hoja del conductor: grafo, exportacion a Maps, listado de clientes y confirmacion de entregas.
- Cuando una ruta supera 10 entregas, Maps se abre por tramos de hasta 10 clientes y la vista movil permite recargar cada tramo o navegar directamente al siguiente cliente.
- Para probar esa vista desde escritorio durante desarrollo, agrega `?mobile=1` a la URL.

Si cambia el dominio publico del servicio backend, actualiza `REMOTE_API_BASE` en `script.js`
o configura `window.VRP_API_BASE` antes de cargar `script.js`.
