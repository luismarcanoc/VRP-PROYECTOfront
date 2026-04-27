# VRP-PROYECTOfront

Aplicacion frontend en HTML, CSS y JavaScript para visualizar y editar un grafo de distribucion de camiones de Pan de Tata.

## Estructura

- `index.html`: menu principal y modulos de la app.
- `styles.css`: estilos base inspirados en `PRUEBA_EMPAQUETADOfrontend`.
- `script.js`: navegacion, carga de CSV, visualizacion del grafo y formularios de edicion.
- `data/rutas_ejemplo.csv`: datos de ejemplo para nodos, rutas, pesos y prioridades.
- `assets/`: logo e imagen de apoyo visual.

## Modulos

- `Visualizar grafo`: muestra el grafo de sucursales y rutas.
- `Modificar datos`: permite editar nodos, prioridades y rutas, asi como agregar nuevos registros.

## Nota

Si abres `index.html` directamente desde el navegador, la app tiene un respaldo interno por si el `fetch` del CSV no se puede leer desde el sistema de archivos. Si la sirves por HTTP, cargara el CSV de `data/rutas_ejemplo.csv`.
