const FALLBACK_API_BASE = "https://vrp-proyectoback.onrender.com/api";

function resolveApiBase() {
    const queryApi = new URLSearchParams(window.location.search).get("api");
    const storedApi = window.localStorage.getItem("VRP_API_BASE") || "";
    const explicitApi = String(window.VRP_API_BASE || "").trim();

    const chosen = explicitApi || queryApi || storedApi;
    if (chosen) {
        window.localStorage.setItem("VRP_API_BASE", chosen);
        return chosen;
    }

    if (window.location.hostname.includes("onrender.com")) {
        return `${window.location.origin}/api`;
    }

    return FALLBACK_API_BASE;
}

const API_BASE = resolveApiBase();

const state = {
    currentPage: "menu",
    nodes: [],
    edges: [],
    selectedNodeId: "",
    sourceMode: "backend",
    routes: [],
    adjustMode: "none",
    selectedClientKey: "",
    clientsInAdjustTable: [],
    adjustClientsRaw: [],
    adjustFilters: {
        query: "",
        transport: "all"
    },
    adjustPagination: {
        pageSize: 50,
        visible: 50
    },
    adjustReachedBottom: false,
    loading: {
        activeRequests: 0
    },
    graphView: {
        scale: 1,
        minScale: 0.65,
        maxScale: 2.4,
        translateX: 0,
        translateY: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        startTranslateX: 0,
        startTranslateY: 0
    }
};

const GRAPH_BOUNDS = {
    width: 840,
    height: 520,
    paddingX: 180,
    paddingY: 180
};

const refs = {
    pages: document.querySelectorAll(".app-page"),
    graphStage: document.getElementById("graph-stage"),
    reloadBackend: document.getElementById("reload-backend"),
    graphRouteSelect: document.getElementById("graph-route-select"),
    graphOriginInput: document.getElementById("graph-origin-input"),
    optimizeRouteBtn: document.getElementById("optimize-route-btn"),
    nodeForm: document.getElementById("node-form"),
    edgeForm: document.getElementById("edge-form"),
    nodeId: document.getElementById("node-id"),
    nodeName: document.getElementById("node-name"),
    nodePriority: document.getElementById("node-priority"),
    edgeOrigin: document.getElementById("edge-origin"),
    edgeDestination: document.getElementById("edge-destination"),
    edgeWeight: document.getElementById("edge-weight"),
    nodesTableBody: document.getElementById("nodes-table-body"),
    edgesTableBody: document.getElementById("edges-table-body"),
    nodesCount: document.getElementById("nodes-count"),
    edgesCount: document.getElementById("edges-count"),
    statusMessage: document.getElementById("status-message"),
    metricNodes: document.getElementById("metric-nodes"),
    metricEdges: document.getElementById("metric-edges"),
    metricPriority: document.getElementById("metric-priority"),
    summaryHub: document.getElementById("summary-hub"),
    summaryLongest: document.getElementById("summary-longest"),
    summaryShortest: document.getElementById("summary-shortest"),
    summaryTotal: document.getElementById("summary-total"),
    modeErrorsBtn: document.getElementById("mode-errors-btn"),
    modeRoutesBtn: document.getElementById("mode-routes-btn"),
    adjustRouteSelect: document.getElementById("adjust-route-select"),
    adjustRouteTableBody: document.getElementById("adjust-route-table-body"),
    adjustTableHeaderRow: document.getElementById("adjust-table-header-row"),
    adjustTableShell: document.querySelector(".adjust-table-shell"),
    adjustSearchInput: document.getElementById("adjust-search-input"),
    adjustTransportFilter: document.getElementById("adjust-transport-filter"),
    adjustResultCount: document.getElementById("adjust-result-count"),
    adjustShowMoreBtn: document.getElementById("adjust-show-more-btn"),
    adjustClientForm: document.getElementById("adjust-client-form"),
    adjustClientId: document.getElementById("adjust-client-id"),
    adjustClientName: document.getElementById("adjust-client-name"),
    adjustClientAddress: document.getElementById("adjust-client-address"),
    adjustClientRoute: document.getElementById("adjust-client-route"),
    adjustClientTransport: document.getElementById("adjust-client-transport"),
    adjustClientModal: document.getElementById("adjust-client-modal"),
    closeClientModal: document.getElementById("close-client-modal"),
    loadingOverlay: document.getElementById("loading-overlay"),
    loadingTitle: document.getElementById("loading-title"),
    loadingSubtitle: document.getElementById("loading-subtitle")
};

function setStatus(message) {
    if (!refs.statusMessage) return;
    refs.statusMessage.textContent = message;
}

function bindIfExists(element, eventName, handler, options) {
    if (!element) return;
    element.addEventListener(eventName, handler, options);
}

function setAdjustTableMessage(message) {
    const colspan = state.adjustMode === "errors" ? 5 : 4;
    refs.adjustRouteTableBody.innerHTML = `<tr><td colspan="${colspan}">${message}</td></tr>`;
}

function extractClients(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.clients)) return payload.clients;
    if (Array.isArray(payload?.data?.clients)) return payload.data.clients;
    if (Array.isArray(payload?.rows)) return payload.rows;
    return [];
}

function normalizeTextForMatch(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function normalizeId(value) {
    return String(value || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, "");
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

async function apiGet(pathname) {
    return withLoading(() => fetchWithErrors(`${API_BASE}${pathname}`), getLoadingCopy(pathname, "GET"));
}

async function apiSend(pathname, options) {
    const config = {
        headers: { "Content-Type": "application/json" },
        ...options
    };
    const method = String(config.method || "POST").toUpperCase();
    return withLoading(
        () => fetchWithErrors(`${API_BASE}${pathname}`, config),
        getLoadingCopy(pathname, method)
    );
}

function showLoading(title, subtitle) {
    if (!refs.loadingOverlay) return;
    refs.loadingTitle.textContent = title || "Cargando datos...";
    refs.loadingSubtitle.textContent = subtitle || "Consultando base de datos del backend. Espera un momento.";
    refs.loadingOverlay.classList.add("is-visible");
    refs.loadingOverlay.setAttribute("aria-busy", "true");
}

function hideLoading() {
    if (!refs.loadingOverlay) return;
    refs.loadingOverlay.classList.remove("is-visible");
    refs.loadingOverlay.setAttribute("aria-busy", "false");
}

function getLoadingCopy(pathname, method) {
    if (pathname.includes("/routes")) {
        return {
            title: "Cargando rutas...",
            subtitle: "Consultando rutas en la base de datos del backend."
        };
    }
    if (pathname.includes("/clients") && method === "GET") {
        return {
            title: "Cargando clientes...",
            subtitle: "Buscando clientes en la base de datos del backend."
        };
    }
    if (pathname.includes("/errors")) {
        return {
            title: "Buscando errores...",
            subtitle: "Validando clientes con datos incompletos en backend."
        };
    }
    if (pathname.includes("/optimize-route")) {
        return {
            title: "Optimizando ruta...",
            subtitle: "Calculando orden de visita y consultando distancias."
        };
    }
    if (pathname.includes("/clients/") && method === "PUT") {
        return {
            title: "Guardando cambios...",
            subtitle: "Actualizando cliente en backend y sincronizando datos."
        };
    }
    return {
        title: "Cargando datos...",
        subtitle: "Consultando base de datos del backend. Espera un momento."
    };
}

async function withLoading(task, copy) {
    state.loading.activeRequests += 1;
    showLoading(copy?.title, copy?.subtitle);
    try {
        return await task();
    } finally {
        state.loading.activeRequests = Math.max(0, state.loading.activeRequests - 1);
        if (state.loading.activeRequests === 0) {
            hideLoading();
        }
    }
}

async function fetchWithErrors(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
            const payload = await response.json();
            message = payload.error || message;
        } catch (_) {}
        throw new Error(message);
    }
    return response.json();
}

function refreshRouteSelects() {
    const prevGraphValue = refs.graphRouteSelect.value;
    const prevAdjustValue = refs.adjustRouteSelect.value;

    refs.graphRouteSelect.innerHTML = "";
    refs.adjustRouteSelect.innerHTML = "";

    refs.graphRouteSelect.add(new Option("Selecciona ruta", ""));
    refs.adjustRouteSelect.add(new Option("Selecciona ruta", ""));

    state.routes.forEach((item) => {
        const label = `${item.route} (${item.totalClients})`;
        refs.graphRouteSelect.add(new Option(label, item.route));
        refs.adjustRouteSelect.add(new Option(label, item.route));
    });

    if (state.routes.some((item) => item.route === prevGraphValue)) {
        refs.graphRouteSelect.value = prevGraphValue;
    }
    if (state.routes.some((item) => item.route === prevAdjustValue)) {
        refs.adjustRouteSelect.value = prevAdjustValue;
    }
}

async function loadInitialData() {
    if (API_BASE.includes("TU-BACKEND")) {
        setStatus("Configura la URL del backend: agrega ?api=https://tu-backend.onrender.com/api");
        return;
    }
    try {
        const payload = await apiGet("/routes");
        state.routes = payload.routes || [];
        refreshRouteSelects();
        state.nodes = [];
        state.edges = [];
        state.sourceMode = "backend";
        setStatus("Rutas cargadas desde backend. Selecciona una ruta y presiona Optimizar.");
    } catch (error) {
        setStatus(`No se pudo conectar al backend: ${error.message}`);
    }

    renderAll();
}

function applyOptimizedResult(result) {
    const nodes = [{ id: "ORIGEN", name: "Centro distribucion", priority: 5 }];
    const edges = [];
    let previousId = "ORIGEN";

    result.sequence.forEach((client, index) => {
        const nodeId = `C${String(index + 1).padStart(3, "0")}`;
        nodes.push({
            id: nodeId,
            name: client.name || client.clientId,
            priority: 3
        });
        edges.push({
            id: `${previousId}__${nodeId}`,
            origin: previousId,
            destination: nodeId,
            weight: Math.max(1, Math.round((client.legDistanceMeters || 0) / 1000))
        });
        previousId = nodeId;
    });

    state.nodes = nodes;
    state.edges = edges;
    renderAll();
}

async function optimizeCurrentRoute() {
    const route = refs.graphRouteSelect.value;
    const origin = String(refs.graphOriginInput.value || "").trim();
    if (!route) {
        setStatus("Selecciona una ruta para optimizar.");
        return;
    }

    try {
        const payload = await apiSend("/optimize-route", {
            method: "POST",
            body: JSON.stringify({ route, origin })
        });
        applyOptimizedResult(payload.optimized);
        setStatus(`Ruta ${route} optimizada con distancia total aprox ${payload.optimized.totalDistanceKm} km.`);
    } catch (error) {
        setStatus(`Error al optimizar: ${error.message}`);
    }
}

function getNodeById(nodeId) {
    return state.nodes.find((node) => node.id === nodeId) || null;
}

function renderAll() {
    renderMetrics();
    renderSelectOptions();
    renderNodesTable();
    renderEdgesTable();
    renderGraph();
    renderSummary();
}

function renderMetrics() {
    if (refs.metricNodes) refs.metricNodes.textContent = String(state.nodes.length);
    if (refs.metricEdges) refs.metricEdges.textContent = String(state.edges.length);
    if (refs.metricPriority) refs.metricPriority.textContent = String(
        state.nodes.reduce((max, node) => Math.max(max, toNumber(node.priority, 0)), 0)
    );
    if (refs.nodesCount) refs.nodesCount.textContent = `${state.nodes.length} nodos`;
    if (refs.edgesCount) refs.edgesCount.textContent = `${state.edges.length} rutas`;
}

function renderSelectOptions() {
    if (!refs.edgeOrigin || !refs.edgeDestination) return;
    const options = state.nodes
        .map((node) => `<option value="${node.id}">${node.id} - ${node.name}</option>`)
        .join("");

    refs.edgeOrigin.innerHTML = `<option value="">Selecciona</option>${options}`;
    refs.edgeDestination.innerHTML = `<option value="">Selecciona</option>${options}`;
}

function renderAdjustTable() {
    applyAdjustFilters();
    renderAdjustTableHeader();
    if (!state.clientsInAdjustTable.length) {
        setAdjustTableMessage("Sin clientes para mostrar.");
        if (refs.adjustResultCount) refs.adjustResultCount.textContent = "0 clientes";
        refs.adjustShowMoreBtn.style.display = "none";
        return;
    }
    const visibleCount = Math.min(state.adjustPagination.visible, state.clientsInAdjustTable.length);
    const visibleClients = state.clientsInAdjustTable.slice(0, visibleCount);
    if (refs.adjustResultCount) refs.adjustResultCount.textContent = `${visibleCount} de ${state.clientsInAdjustTable.length} clientes`;
    refs.adjustRouteTableBody.innerHTML = visibleClients
        .map((client) => `
            <tr>
                <td>${client.clientId}</td>
                <td>${client.nombre_o_razon_social || client.name || "-"}</td>
                <td>${client.address || "-"}</td>
                ${state.adjustMode === "errors" ? `<td>${getClientErrorLabel(client)}</td>` : ""}
                <td>
                    <div class="table-actions">
                        <button type="button" data-edit-client="${encodeURIComponent(client.key)}">Editar</button>
                    </div>
                </td>
            </tr>
        `)
        .join("");

    const hasMore = visibleCount < state.clientsInAdjustTable.length;
    refs.adjustShowMoreBtn.style.display = hasMore && state.adjustReachedBottom ? "inline-flex" : "none";
    refs.adjustShowMoreBtn.textContent = hasMore
        ? `Mostrar mas (${Math.min(state.adjustPagination.pageSize, state.clientsInAdjustTable.length - visibleCount)})`
        : "Mostrar mas";
}

function renderAdjustTableHeader() {
    if (!refs.adjustTableHeaderRow) return;
    refs.adjustTableHeaderRow.innerHTML = `
        <th>Cliente</th>
        <th>Nombre</th>
        <th>Direccion</th>
        ${state.adjustMode === "errors" ? "<th>Error</th>" : ""}
        <th>Acciones</th>
    `;
}

function getClientErrorLabel(client) {
    const issues = [];
    if (!String(client.clientId || "").trim()) issues.push("Cliente vacio");
    if (!String(client.nombre_o_razon_social || client.name || "").trim()) issues.push("Nombre vacio");
    const address = String(client.address || "").trim();
    if (!address || address === "0") issues.push("Direccion invalida");
    const route = String(client.route || "").trim();
    if (!route) issues.push("Ruta vacia");
    else if (normalizeTextForMatch(route).includes("revisar manualmente")) issues.push("Ruta: revisar manualmente");
    return issues.length ? issues.join(" | ") : "Sin error";
}

function applyAdjustFilters() {
    const source = Array.isArray(state.adjustClientsRaw) ? state.adjustClientsRaw : [];
    const query = String(state.adjustFilters.query || "").trim().toLowerCase();
    const transport = String(state.adjustFilters.transport || "all").trim().toLowerCase();

    state.clientsInAdjustTable = source.filter((client) => {
        const clientTransport = String(client.transport || "").trim().toLowerCase();
        if (transport !== "all" && clientTransport !== transport) return false;
        if (!query) return true;
        const haystack = [
            client.clientId,
            client.nombre_o_razon_social,
            client.name,
            client.address,
            client.route,
            client.transport
        ]
            .map((value) => String(value || "").toLowerCase())
            .join(" ");
        return haystack.includes(query);
    });
}

function updateAdjustModeButtons() {
    refs.modeErrorsBtn.classList.toggle("is-active", state.adjustMode === "errors");
    refs.modeRoutesBtn.classList.toggle("is-active", state.adjustMode === "routes");
}

function syncTransportFilterOptions() {
    if (!refs.adjustTransportFilter) return;
    const current = refs.adjustTransportFilter.value || "all";
    const transports = Array.from(
        new Set(
            (state.adjustClientsRaw || [])
                .map((item) => String(item.transport || "").trim())
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b));

    refs.adjustTransportFilter.innerHTML = `<option value="all">Todos los transportes</option>${transports
        .map((value) => `<option value="${value}">${value}</option>`)
        .join("")}`;

    const isCurrentValid = current === "all" || transports.includes(current);
    refs.adjustTransportFilter.value = isCurrentValid ? current : "all";
    state.adjustFilters.transport = refs.adjustTransportFilter.value;
}

async function setAdjustMode(mode) {
    state.adjustMode = mode;
    state.adjustPagination.visible = state.adjustPagination.pageSize;
    state.adjustReachedBottom = false;
    updateAdjustModeButtons();
    if (mode === "errors") {
        const payload = await apiGet("/errors");
        state.adjustClientsRaw = extractClients(payload);
        syncTransportFilterOptions();
        renderAdjustTable();
        if (refs.adjustTableShell) refs.adjustTableShell.scrollTop = 0;
        setStatus(`Mostrando ${state.adjustClientsRaw.length} clientes con errores.`);
        return;
    }
    await loadClientsByAdjustRoute();
}

async function loadClientsByAdjustRoute() {
    const route = refs.adjustRouteSelect.value;
    state.adjustMode = "routes";
    state.adjustPagination.visible = state.adjustPagination.pageSize;
    state.adjustReachedBottom = false;
    updateAdjustModeButtons();
    if (!route) {
        state.adjustClientsRaw = [];
        syncTransportFilterOptions();
        renderAdjustTable();
        setStatus("Selecciona una ruta para mostrar clientes.");
        return;
    }
    const payload = await apiGet(`/clients?route=${encodeURIComponent(route)}`);
    let clients = extractClients(payload);

    // Fallback defensivo: si el filtro exacto en backend falla por formato de texto,
    // trae todo y filtra en frontend por ruta normalizada.
    if (!clients.length) {
        const allPayload = await apiGet("/clients");
        const allClients = extractClients(allPayload);
        const routeKey = normalizeTextForMatch(route);
        clients = allClients.filter(
            (client) => normalizeTextForMatch(client.route) === routeKey
        );
    }

    state.adjustClientsRaw = clients;
    syncTransportFilterOptions();
    renderAdjustTable();
    if (refs.adjustTableShell) refs.adjustTableShell.scrollTop = 0;
    setStatus(`Ruta ${route}: ${state.adjustClientsRaw.length} clientes cargados.`);
}

function fillAdjustFormByKey(encodedKey) {
    const key = decodeURIComponent(encodedKey);
    const client = state.clientsInAdjustTable.find((item) => item.key === key);
    if (!client) return;
    state.selectedClientKey = key;
    refs.adjustClientId.value = client.clientId;
    refs.adjustClientName.value = client.nombre_o_razon_social || client.name || "";
    refs.adjustClientAddress.value = client.address || "";
    populateAdjustModalSelects(client);
    refs.adjustClientRoute.value = client.route || "";
    refs.adjustClientTransport.value = client.transport || "";
    refs.adjustClientModal.style.display = "flex";
}

function populateAdjustModalSelects(client) {
    if (!refs.adjustClientRoute || !refs.adjustClientTransport) return;

    const routeOptions = Array.from(
        new Set(
            [
                ...(state.routes || []).map((item) => String(item.route || "").trim()),
                String(client?.route || "").trim()
            ].filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b));

    const transportOptions = Array.from(
        new Set(
            [
                ...(state.adjustClientsRaw || []).map((item) => String(item.transport || "").trim()),
                ...(state.clientsInAdjustTable || []).map((item) => String(item.transport || "").trim()),
                String(client?.transport || "").trim()
            ].filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b));

    refs.adjustClientRoute.innerHTML = routeOptions
        .map((route) => `<option value="${route}">${route}</option>`)
        .join("");

    refs.adjustClientTransport.innerHTML = [
        `<option value="">Sin transporte</option>`,
        ...transportOptions.map((transport) => `<option value="${transport}">${transport}</option>`)
    ].join("");
}

async function submitAdjustForm(event) {
    event.preventDefault();
    if (!state.selectedClientKey) {
        setStatus("Selecciona un cliente desde la tabla para editar.");
        return;
    }
    try {
        await apiSend(`/clients/${encodeURIComponent(state.selectedClientKey)}`, {
            method: "PUT",
            body: JSON.stringify({
                name: refs.adjustClientName.value,
                address: refs.adjustClientAddress.value,
                route: refs.adjustClientRoute.value,
                transport: refs.adjustClientTransport.value
            })
        });
        setStatus("Cliente actualizado correctamente.");
        refs.adjustClientModal.style.display = "none";
        try {
            const routesPayload = await apiGet("/routes");
            state.routes = routesPayload.routes || [];
            refreshRouteSelects();
        } catch (_) {}
        if (state.adjustMode === "errors") {
            await setAdjustMode("errors");
        } else {
            if (refs.adjustRouteSelect && refs.adjustClientRoute?.value) {
                refs.adjustRouteSelect.value = refs.adjustClientRoute.value;
            }
            await loadClientsByAdjustRoute();
        }
    } catch (error) {
        setStatus(`No se pudo guardar: ${error.message}`);
    }
}

function renderNodesTable() {
    if (!refs.nodesTableBody) return;
    if (!state.nodes.length) {
        refs.nodesTableBody.innerHTML = `<tr><td colspan="4">Sin nodos registrados.</td></tr>`;
        return;
    }

    refs.nodesTableBody.innerHTML = state.nodes
        .map((node) => `
            <tr>
                <td>${node.id}</td>
                <td>${node.name}</td>
                <td>${node.priority}</td>
                <td>
                    <div class="table-actions">
                        <button type="button" data-edit-node="${node.id}">Editar</button>
                        <button type="button" class="danger-btn" data-delete-node="${node.id}">Eliminar</button>
                    </div>
                </td>
            </tr>
        `)
        .join("");
}

function renderEdgesTable() {
    if (!refs.edgesTableBody) return;
    if (!state.edges.length) {
        refs.edgesTableBody.innerHTML = `<tr><td colspan="4">Sin rutas registradas.</td></tr>`;
        return;
    }

    refs.edgesTableBody.innerHTML = state.edges
        .map((edge) => `
            <tr>
                <td>${edge.origin}</td>
                <td>${edge.destination}</td>
                <td>${edge.weight}</td>
                <td>
                    <div class="table-actions">
                        <button type="button" data-edit-edge="${edge.id}">Editar</button>
                        <button type="button" class="danger-btn" data-delete-edge="${edge.id}">Eliminar</button>
                    </div>
                </td>
            </tr>
        `)
        .join("");
}

function getNodePositions() {
    const centerX = GRAPH_BOUNDS.width / 2;
    const centerY = GRAPH_BOUNDS.height / 2;
    const radius = 170;
    const total = state.nodes.length || 1;
    const positions = new Map();

    state.nodes.forEach((node, index) => {
        if (index === 0) {
            positions.set(node.id, { x: centerX, y: centerY });
            return;
        }

        const angle = ((index - 1) / Math.max(total - 1, 1)) * Math.PI * 2 - Math.PI / 2;
        positions.set(node.id, {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        });
    });

    return positions;
}

function renderGraph() {
    if (!state.nodes.length) {
        refs.graphStage.innerHTML = `<div class="empty-state">No hay nodos para visualizar.</div>`;
        return;
    }
    const positions = getNodePositions();
    const maxWeight = state.edges.reduce((max, edge) => Math.max(max, edge.weight), 1);
    const minWeight = state.edges.reduce((min, edge) => Math.min(min, edge.weight), maxWeight);
    const edgesSvg = state.edges
        .map((edge) => {
            const origin = positions.get(edge.origin);
            const destination = positions.get(edge.destination);
            if (!origin || !destination) return "";
            const midX = (origin.x + destination.x) / 2;
            const midY = (origin.y + destination.y) / 2;
            const edgeColor = getEdgeColor(edge.weight, minWeight, maxWeight);
            return `
                <g>
                    <line x1="${origin.x}" y1="${origin.y}" x2="${destination.x}" y2="${destination.y}"
                        stroke="${edgeColor}" stroke-width="4" stroke-linecap="round" />
                    <text x="${midX}" y="${midY - 8}" fill="#5f4634" font-size="13" font-weight="700" text-anchor="middle">
                        ${edge.weight}
                    </text>
                </g>
            `;
        })
        .join("");
    const nodesSvg = state.nodes
        .map((node) => {
            const position = positions.get(node.id);
            if (!position) return "";
            const radius = 22 + (node.priority || 3) * 3;
            return `
                <g class="graph-node" data-node-id="${node.id}">
                    <circle cx="${position.x}" cy="${position.y}" r="${radius}" fill="#fff8ed" stroke="#c06e32" stroke-width="3"></circle>
                    <circle cx="${position.x}" cy="${position.y}" r="${Math.max(8, radius - 12)}" fill="rgba(192,110,50,0.14)"></circle>
                    <text x="${position.x}" y="${position.y + 5}" fill="#000000" font-size="13" font-weight="800" text-anchor="middle">
                        ${node.nombre_o_razon_social || node.name || node.id}
                    </text>
                </g>
            `;
        })
        .join("");
    refs.graphStage.innerHTML = `
        <svg viewBox="${-GRAPH_BOUNDS.paddingX} ${-GRAPH_BOUNDS.paddingY} ${GRAPH_BOUNDS.width + (GRAPH_BOUNDS.paddingX * 2)} ${GRAPH_BOUNDS.height + (GRAPH_BOUNDS.paddingY * 2)}" role="img" aria-label="Grafo de rutas de distribucion" preserveAspectRatio="xMidYMid meet">
            <g id="graph-viewport" transform="translate(${state.graphView.translateX} ${state.graphView.translateY}) scale(${state.graphView.scale})">
                ${edgesSvg}
                ${nodesSvg}
            </g>
        </svg>
        <div id="graph-node-popup" class="modal" style="display:none;position:absolute;"></div>
    `;
    syncGraphViewportTransform();
    // Bind hover para mostrar pop-up de detalles
    const svg = refs.graphStage.querySelector("svg");
    if (!svg) return;
    svg.querySelectorAll('.graph-node').forEach((el) => {
        el.addEventListener('mouseenter', (e) => {
            const nodeId = el.getAttribute('data-node-id');
            const node = state.nodes.find(n => n.id === nodeId);
            if (!node) return;
            const popup = document.getElementById('graph-node-popup');
            popup.innerHTML = `<div class='modal-content' style='padding:18px 22px;max-width:320px;'>
                <strong>${node.nombre_o_razon_social || node.name || node.id}</strong><br>
                <span><b>Cliente:</b> ${node.clientId || node.id}</span><br>
                <span><b>Dirección:</b> ${node.address || '-'}</span><br>
                <span><b>Ruta:</b> ${node.route || '-'}</span><br>
                <span><b>Transporte:</b> ${node.transport || node.tipo_transporte || '-'}</span>
            </div>`;
            popup.style.display = 'block';
            popup.style.left = (e.clientX + 20) + 'px';
            popup.style.top = (e.clientY - 20) + 'px';
        });
        el.addEventListener('mouseleave', () => {
            const popup = document.getElementById('graph-node-popup');
            popup.style.display = 'none';
        });
    });
}

function getEdgeColor(weight, minWeight, maxWeight) {
    if (maxWeight === minWeight) {
        return "rgb(180, 90, 80)";
    }

    const ratio = (weight - minWeight) / (maxWeight - minWeight);
    const hue = 220 - (220 * ratio);
    return `hsl(${hue}, 75%, 50%)`;
}

function syncGraphViewportTransform() {
    const viewport = document.getElementById("graph-viewport");
    if (!viewport) return;
    viewport.setAttribute(
        "transform",
        `translate(${state.graphView.translateX} ${state.graphView.translateY}) scale(${state.graphView.scale})`
    );
}

function clampGraphPan() {
    const scale = state.graphView.scale;
    const maxX = Math.max(0, (GRAPH_BOUNDS.width * (scale - 1)) / 2);
    const maxY = Math.max(0, (GRAPH_BOUNDS.height * (scale - 1)) / 2);
    state.graphView.translateX = Math.min(maxX, Math.max(-maxX, state.graphView.translateX));
    state.graphView.translateY = Math.min(maxY, Math.max(-maxY, state.graphView.translateY));
}

function setGraphScale(nextScale, anchorX = GRAPH_BOUNDS.width / 2, anchorY = GRAPH_BOUNDS.height / 2) {
    const previousScale = state.graphView.scale;
    const clampedScale = Math.min(state.graphView.maxScale, Math.max(state.graphView.minScale, nextScale));
    if (clampedScale === previousScale) return;

    const worldX = (anchorX - state.graphView.translateX) / previousScale;
    const worldY = (anchorY - state.graphView.translateY) / previousScale;
    state.graphView.scale = clampedScale;
    state.graphView.translateX = anchorX - worldX * clampedScale;
    state.graphView.translateY = anchorY - worldY * clampedScale;
    clampGraphPan();
    syncGraphViewportTransform();
}

function bindGraphInteractions() {
    if (!refs.graphStage) return;
    refs.graphStage.addEventListener("wheel", (event) => {
        const svg = refs.graphStage.querySelector("svg");
        if (!svg) return;
        event.preventDefault();

        const rect = svg.getBoundingClientRect();
        const viewX = ((event.clientX - rect.left) / rect.width) * GRAPH_BOUNDS.width;
        const viewY = ((event.clientY - rect.top) / rect.height) * GRAPH_BOUNDS.height;
        const factor = event.deltaY < 0 ? 1.12 : 0.9;
        setGraphScale(state.graphView.scale * factor, viewX, viewY);
    }, { passive: false });

    refs.graphStage.addEventListener("pointerdown", (event) => {
        if (!refs.graphStage.querySelector("svg")) return;
        state.graphView.isDragging = true;
        state.graphView.dragStartX = event.clientX;
        state.graphView.dragStartY = event.clientY;
        state.graphView.startTranslateX = state.graphView.translateX;
        state.graphView.startTranslateY = state.graphView.translateY;
        refs.graphStage.classList.add("is-dragging");
        refs.graphStage.setPointerCapture(event.pointerId);
    });

    refs.graphStage.addEventListener("pointermove", (event) => {
        if (!state.graphView.isDragging) return;
        const svg = refs.graphStage.querySelector("svg");
        if (!svg) return;

        const rect = svg.getBoundingClientRect();
        const deltaX = ((event.clientX - state.graphView.dragStartX) / rect.width) * GRAPH_BOUNDS.width;
        const deltaY = ((event.clientY - state.graphView.dragStartY) / rect.height) * GRAPH_BOUNDS.height;
        state.graphView.translateX = state.graphView.startTranslateX + deltaX;
        state.graphView.translateY = state.graphView.startTranslateY + deltaY;
        clampGraphPan();
        syncGraphViewportTransform();
    });

    const stopDragging = (event) => {
        if (event && refs.graphStage.hasPointerCapture(event.pointerId)) {
            refs.graphStage.releasePointerCapture(event.pointerId);
        }
        state.graphView.isDragging = false;
        refs.graphStage.classList.remove("is-dragging");
    };

    refs.graphStage.addEventListener("pointerup", stopDragging);
    refs.graphStage.addEventListener("pointercancel", stopDragging);
    refs.graphStage.addEventListener("pointerleave", stopDragging);
}

function renderSummary() {
    if (!refs.summaryHub || !refs.summaryShortest || !refs.summaryLongest || !refs.summaryTotal) return;
    const plantNode = state.nodes.reduce((best, node) => {
        if (!best) return node;
        return node.priority > best.priority ? node : best;
    }, null);

    const sortedEdges = [...state.edges].sort((a, b) => a.weight - b.weight);
    const shortest = sortedEdges[0];
    const longest = sortedEdges[sortedEdges.length - 1];

    refs.summaryHub.textContent = plantNode ? `${plantNode.name} (${plantNode.id})` : "-";
    refs.summaryShortest.textContent = shortest ? `${shortest.origin} -> ${shortest.destination} (${shortest.weight})` : "-";
    refs.summaryLongest.textContent = longest ? `${longest.origin} -> ${longest.destination} (${longest.weight})` : "-";
    refs.summaryTotal.textContent = String(state.edges.length);
}

function changePage(nextPage) {
    state.currentPage = nextPage;
    refs.pages.forEach((page) => {
        page.classList.toggle("active", page.id === `page-${nextPage}`);
    });

    if (nextPage === "graph") {
        renderGraph();
        renderSummary();
    }
    if (nextPage === "adjust" && refs.adjustRouteSelect.value) {
        loadClientsByAdjustRoute().catch((error) => setStatus(`No se pudieron cargar clientes: ${error.message}`));
    }
}

function resetNodeForm() {
    refs.nodeForm.reset();
    refs.nodePriority.value = "3";
    state.selectedNodeId = "";
}

function upsertNode(node) {
    const existingIndex = state.nodes.findIndex((item) => item.id === node.id);
    if (existingIndex >= 0) {
        state.nodes[existingIndex] = node;
    } else {
        state.nodes.push(node);
    }
    state.nodes.sort((a, b) => a.id.localeCompare(b.id));
}

function handleNodeSubmit(event) {
    event.preventDefault();

    const node = {
        id: normalizeId(refs.nodeId.value),
        name: String(refs.nodeName.value || "").trim(),
        priority: Math.max(1, toNumber(refs.nodePriority.value, 1))
    };

    if (!node.id || !node.name) {
        setStatus("Completa el codigo y el nombre del nodo.");
        return;
    }

    const previousId = normalizeId(state.selectedNodeId);
    if (previousId && previousId !== node.id) {
        state.edges = state.edges.map((edge) => ({
            ...edge,
            origin: edge.origin === previousId ? node.id : edge.origin,
            destination: edge.destination === previousId ? node.id : edge.destination
        }));
    }

    upsertNode(node);
    state.edges = state.edges.map((edge) => ({
        ...edge,
        id: `${edge.origin}__${edge.destination}`
    }));

    renderAll();
    resetNodeForm();
    setStatus(`Nodo ${node.id} guardado correctamente.`);
}

function handleEdgeSubmit(event) {
    event.preventDefault();

    const origin = normalizeId(refs.edgeOrigin.value);
    const destination = normalizeId(refs.edgeDestination.value);
    const weight = Math.max(1, toNumber(refs.edgeWeight.value, 1));

    if (!origin || !destination) {
        setStatus("Selecciona origen y destino para la ruta.");
        return;
    }

    if (origin === destination) {
        setStatus("La ruta necesita nodos distintos en origen y destino.");
        return;
    }

    const edgeId = `${origin}__${destination}`;
    const existingIndex = state.edges.findIndex((edge) => edge.id === edgeId);
    const nextEdge = { id: edgeId, origin, destination, weight };

    if (existingIndex >= 0) {
        state.edges[existingIndex] = nextEdge;
    } else {
        state.edges.push(nextEdge);
    }

    state.edges.sort((a, b) => a.origin.localeCompare(b.origin) || a.destination.localeCompare(b.destination));
    renderAll();
    refs.edgeForm.reset();
    refs.edgeWeight.value = "10";
    setStatus(`Ruta ${origin} -> ${destination} guardada correctamente.`);
}

function fillNodeForm(nodeId) {
    const node = getNodeById(nodeId);
    if (!node) return;
    state.selectedNodeId = node.id;
    refs.nodeId.value = node.id;
    refs.nodeName.value = node.name;
    refs.nodePriority.value = String(node.priority);
    changePage("edit");
    setStatus(`Editando nodo ${node.id}.`);
}

function fillEdgeForm(edgeId) {
    const edge = state.edges.find((item) => item.id === edgeId);
    if (!edge) return;
    refs.edgeOrigin.value = edge.origin;
    refs.edgeDestination.value = edge.destination;
    refs.edgeWeight.value = String(edge.weight);
    changePage("edit");
    setStatus(`Editando ruta ${edge.origin} -> ${edge.destination}.`);
}

function deleteNode(nodeId) {
    state.nodes = state.nodes.filter((node) => node.id !== nodeId);
    state.edges = state.edges.filter((edge) => edge.origin !== nodeId && edge.destination !== nodeId);
    renderAll();
    resetNodeForm();
    setStatus(`Nodo ${nodeId} eliminado junto a sus rutas asociadas.`);
}

function deleteEdge(edgeId) {
    state.edges = state.edges.filter((edge) => edge.id !== edgeId);
    renderAll();
    setStatus(`Ruta ${edgeId.replace("__", " -> ")} eliminada.`);
}

function bindEvents() {
    document.querySelectorAll("[data-go-page]").forEach((button) => {
        button.addEventListener("click", () => {
            changePage(button.dataset.goPage);
        });
    });

    bindIfExists(refs.reloadBackend, "click", loadInitialData);
    bindIfExists(refs.optimizeRouteBtn, "click", optimizeCurrentRoute);
    bindIfExists(refs.nodeForm, "submit", handleNodeSubmit);
    bindIfExists(refs.edgeForm, "submit", handleEdgeSubmit);
    bindIfExists(refs.modeErrorsBtn, "click", () => setAdjustMode("errors").catch((e) => setStatus(e.message)));
    bindIfExists(refs.modeRoutesBtn, "click", () => setAdjustMode("routes").catch((e) => setStatus(e.message)));
    const loadRouteClientsSafely = async () => {
        try {
            await loadClientsByAdjustRoute();
        } catch (error) {
            state.adjustClientsRaw = [];
            refs.adjustShowMoreBtn.style.display = "none";
            if (refs.adjustResultCount) refs.adjustResultCount.textContent = "0 clientes";
            setAdjustTableMessage(`Error cargando clientes: ${error.message}`);
            setStatus(`Error cargando clientes: ${error.message}`);
        }
    };
    bindIfExists(refs.adjustRouteSelect, "change", () => loadRouteClientsSafely());
    bindIfExists(refs.adjustRouteSelect, "input", () => loadRouteClientsSafely());
    bindIfExists(refs.adjustShowMoreBtn, "click", () => {
        state.adjustPagination.visible += state.adjustPagination.pageSize;
        state.adjustReachedBottom = false;
        renderAdjustTable();
    });
    bindIfExists(refs.adjustTableShell, "scroll", () => {
        const el = refs.adjustTableShell;
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
        state.adjustReachedBottom = atBottom;
        const hasMore = state.adjustPagination.visible < state.clientsInAdjustTable.length;
        refs.adjustShowMoreBtn.style.display = hasMore && atBottom ? "inline-flex" : "none";
    });
    bindIfExists(refs.adjustSearchInput, "input", () => {
        state.adjustFilters.query = refs.adjustSearchInput.value || "";
        state.adjustPagination.visible = state.adjustPagination.pageSize;
        state.adjustReachedBottom = false;
        renderAdjustTable();
    });
    bindIfExists(refs.adjustTransportFilter, "change", () => {
        state.adjustFilters.transport = refs.adjustTransportFilter.value || "all";
        state.adjustPagination.visible = state.adjustPagination.pageSize;
        state.adjustReachedBottom = false;
        renderAdjustTable();
    });
    bindIfExists(refs.adjustClientForm, "submit", submitAdjustForm);
    bindIfExists(refs.closeClientModal, "click", () => {
        refs.adjustClientModal.style.display = "none";
    });
    bindIfExists(refs.adjustClientModal, "click", (event) => {
        if (event.target === refs.adjustClientModal) {
            refs.adjustClientModal.style.display = "none";
        }
    });

    bindIfExists(refs.nodesTableBody, "click", (event) => {
        const target = event.target.closest("button");
        if (!target) return;
        if (target.dataset.editNode) fillNodeForm(target.dataset.editNode);
        if (target.dataset.deleteNode) deleteNode(target.dataset.deleteNode);
    });

    bindIfExists(refs.edgesTableBody, "click", (event) => {
        const target = event.target.closest("button");
        if (!target) return;
        if (target.dataset.editEdge) fillEdgeForm(target.dataset.editEdge);
        if (target.dataset.deleteEdge) deleteEdge(target.dataset.deleteEdge);
    });

    bindIfExists(refs.adjustRouteTableBody, "click", (event) => {
        const target = event.target.closest("button");
        if (!target) return;
        if (target.dataset.editClient) fillAdjustFormByKey(target.dataset.editClient);
    });
}

function init() {
    bindEvents();
    bindGraphInteractions();
    updateAdjustModeButtons();
    loadInitialData();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

