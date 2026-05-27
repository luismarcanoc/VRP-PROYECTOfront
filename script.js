const LOCAL_API_BASE = "http://localhost:10000/api";
const REMOTE_API_BASE = "https://vrp-proyectoback.onrender.com/api";
const REMOTE_PDT_MENU_URL = "https://prueba-empaquetad-ofrontend-theta.vercel.app/#menu";

function resolveApiBase() {
    const queryApi = new URLSearchParams(window.location.search).get("api");
    const storedApi = window.localStorage.getItem("VRP_API_BASE") || "";
    const explicitApi = String(window.VRP_API_BASE || "").trim();
    const isLocalFrontend = ["", "localhost", "127.0.0.1"].includes(window.location.hostname)
        || window.location.protocol === "file:";

    if (explicitApi || queryApi) {
        const chosen = explicitApi || queryApi;
        window.localStorage.setItem("VRP_API_BASE", chosen);
        return chosen;
    }

    if (isLocalFrontend) {
        const localChoice = !storedApi || storedApi.includes("onrender.com") ? LOCAL_API_BASE : storedApi;
        window.localStorage.setItem("VRP_API_BASE", localChoice);
        return localChoice;
    }

    if (storedApi) {
        return storedApi;
    }

    if (window.location.hostname.includes("onrender.com")) {
        return `${window.location.origin}/api`;
    }

    return REMOTE_API_BASE;
}

const API_BASE = resolveApiBase();

function resolveMainMenuUrl() {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("returnTo");
    const configured = String(window.PDT_MAIN_MENU_URL || "").trim();
    const isLocalFrontend = ["", "localhost", "127.0.0.1"].includes(window.location.hostname)
        || window.location.protocol === "file:";
    const fallback = isLocalFrontend
        ? "../PruebaEmpaqFront/PRUEBA_EMPAQUETADOfrontend/index.html#menu"
        : REMOTE_PDT_MENU_URL;
    const candidate = returnTo || configured || fallback;

    try {
        const url = new URL(candidate, window.location.href);
        if (["http:", "https:", "file:"].includes(url.protocol)) {
            return url.href;
        }
    } catch (_) {}

    return new URL(fallback, window.location.href).href;
}

function openMainMenu() {
    window.location.assign(resolveMainMenuUrl());
}

const ALL_ROUTES_VALUE = "__ALL_ROUTES__";
const DISTRIBUTION_ORIGIN = {
    name: "PDT Bello Campo",
    fullName: "PDT Bello Campo (PDT)",
    address: "Edificio Onnis, Avenida Francisco de Miranda, & Avenida Coromoto, Caracas 1060, Miranda, Venezuela"
};

const state = {
    currentPage: "menu",
    nodes: [],
    edges: [],
    selectedNodeId: "",
    sourceMode: "backend",
    routes: [],
    totalClients: 0,
    totalAdjust: 0,
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
        activeRequests: 0,
        timer: null,
        visible: false
    },
    mapsConfig: {
        loaded: false,
        enabled: false,
        browserApiKey: "",
        origin: DISTRIBUTION_ORIGIN.address,
        originName: DISTRIBUTION_ORIGIN.name,
        missing: []
    },
    optimizedRoute: null,
    googleMap: null,
    googleMapLayers: [],
    googleMapsScriptPromise: null,
    graphCalculationError: "",
    mobile: {
        active: false,
        view: "route",
        clients: [],
        selectedClientKey: "",
        sheetUnlocked: false
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
        startTranslateY: 0,
        activePointers: new Map(),
        isPinching: false,
        pinchStartDistance: 0,
        pinchStartScale: 1,
        pinchAnchorX: 0,
        pinchAnchorY: 0
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
    graphRouteSelect: document.getElementById("graph-route-select"),
    optimizeRouteBtn: document.getElementById("optimize-route-btn"),
    exportGoogleMapsBtn: document.getElementById("export-google-maps-btn"),
    desktopGraphSlot: document.getElementById("desktop-graph-slot"),
    mobileGraphSlot: document.getElementById("mobile-graph-slot"),
    mobileDriverApp: document.getElementById("mobile-driver-app"),
    mobileRouteView: document.getElementById("mobile-route-view"),
    mobileSheetView: document.getElementById("mobile-sheet-view"),
    mobileDetailView: document.getElementById("mobile-detail-view"),
    mobileRouteSelect: document.getElementById("mobile-route-select"),
    mobileOptimizeRouteBtn: document.getElementById("mobile-optimize-route-btn"),
    mobileExportGoogleMapsBtn: document.getElementById("mobile-export-google-maps-btn"),
    mobileOpenSheetBtn: document.getElementById("mobile-open-sheet-btn"),
    mobileSheetBackBtn: document.getElementById("mobile-sheet-back-btn"),
    mobileDetailBackBtn: document.getElementById("mobile-detail-back-btn"),
    mobileDeliveredBtn: document.getElementById("mobile-delivered-btn"),
    mobileRoutePlate: document.getElementById("mobile-route-plate"),
    mobileRouteName: document.getElementById("mobile-route-name"),
    mobileSheetPlate: document.getElementById("mobile-sheet-plate"),
    mobileSheetRoute: document.getElementById("mobile-sheet-route"),
    mobileSelectedTitle: document.getElementById("mobile-selected-title"),
    mobileClientList: document.getElementById("mobile-client-list"),
    mobileDetailClient: document.getElementById("mobile-detail-client"),
    mobileProductsList: document.getElementById("mobile-products-list"),
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
    metricClients: document.getElementById("metric-clients"),
    metricRoutes: document.getElementById("metric-routes"),
    metricAdjust: document.getElementById("metric-adjust"),
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
    downloadErrorsXlsxBtn: document.getElementById("download-errors-xlsx-btn"),
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

function getRouteDisplay(routeValue) {
    const route = String(routeValue || "").trim();
    const found = (state.routes || []).find((item) => String(item.route || "") === route);
    return found?.displayName || found?.routeName || route;
}

function getRouteOptionLabel(item) {
    const name = item.displayName || item.routeName || item.route || "SIN RUTA";
    const count = Number(item.totalClients || 0);
    return `${name} (${count})`;
}

function isMobileDriverDevice() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mobile") === "1") return true;
    if (params.get("mobile") === "0") return false;
    const agentMobile = Boolean(navigator.userAgentData?.mobile)
        || /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return agentMobile || (window.matchMedia("(max-width: 760px)").matches && navigator.maxTouchPoints > 0);
}

function getSelectedRouteInfo() {
    const value = refs.graphRouteSelect?.value || refs.mobileRouteSelect?.value || "";
    return state.routes.find((item) => String(item.route || "") === value) || null;
}

function getMobileRouteShortName(routeInfo) {
    return String(routeInfo?.routeName || routeInfo?.displayName || "-").trim() || "-";
}

function syncMobileRouteHeader() {
    const routeInfo = getSelectedRouteInfo();
    const plate = String(routeInfo?.truck || "-").trim() || "-";
    const routeName = getMobileRouteShortName(routeInfo);
    if (refs.mobileRoutePlate) refs.mobileRoutePlate.textContent = plate;
    if (refs.mobileSheetPlate) refs.mobileSheetPlate.textContent = plate;
    if (refs.mobileRouteName) refs.mobileRouteName.textContent = routeName;
    if (refs.mobileSheetRoute) refs.mobileSheetRoute.textContent = routeName;
    if (refs.mobileSelectedTitle) {
        refs.mobileSelectedTitle.textContent = routeInfo?.displayName || routeInfo?.routeName || "Selecciona una ruta";
    }
}

function setExportButtonsDisabled(disabled) {
    if (refs.exportGoogleMapsBtn) refs.exportGoogleMapsBtn.disabled = disabled;
    if (refs.mobileExportGoogleMapsBtn) refs.mobileExportGoogleMapsBtn.disabled = disabled;
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

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function truncateText(value, maxLength = 24) {
    const text = String(value || "").trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function getClientProductSummary(client) {
    const detail = Array.isArray(client?.detail) ? client.detail : [];
    const total = detail.reduce((sum, item) => sum + toNumber(item.cantidad, 0), 0);
    const uniqueProducts = new Set(detail.map((item) => String(item.producto || "").trim()).filter(Boolean));
    if (!detail.length) return "Sin detalle de productos";
    return `${total} unidades en ${uniqueProducts.size || detail.length} producto${(uniqueProducts.size || detail.length) === 1 ? "" : "s"}`;
}

function getProductName(item) {
    return String(
        item?.producto
        || item?.nombre_producto
        || item?.nombre
        || item?.descripcion
        || item?.descripcion_producto
        || "Producto"
    ).trim();
}

function getProductQuantity(item) {
    return toNumber(
        item?.cantidad ?? item?.cantidad_producto ?? item?.unidades ?? item?.qty,
        0
    );
}

function getClientBaskets(client) {
    return Math.max(0, toNumber(client?.baskets ?? client?.cantidad_cestas ?? client?.cestas, 0));
}

function sanitizeNumericValue(value) {
    return String(value || "").replace(/\D/g, "");
}

function getClientDeliveredBaskets(client) {
    if (client?.deliveredBaskets !== null && client?.deliveredBaskets !== undefined) {
        return Math.max(0, Math.trunc(toNumber(client.deliveredBaskets, 0)));
    }
    return getClientBaskets(client);
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

function showLoading() {
    if (!refs.loadingOverlay) return;
    refs.loadingTitle.textContent = "Cargando";
    if (refs.loadingSubtitle) refs.loadingSubtitle.textContent = "";
    refs.loadingOverlay.classList.add("is-visible");
    refs.loadingOverlay.setAttribute("aria-busy", "true");
    state.loading.visible = true;
}

function hideLoading() {
    if (!refs.loadingOverlay) return;
    if (state.loading.timer) {
        window.clearTimeout(state.loading.timer);
        state.loading.timer = null;
    }
    refs.loadingOverlay.classList.remove("is-visible");
    refs.loadingOverlay.setAttribute("aria-busy", "false");
    state.loading.visible = false;
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
    if (pathname.includes("/deliveries/") && method === "PUT") {
        return {
            title: "Confirmando entrega...",
            subtitle: "Guardando el estado de la parada."
        };
    }
    return {
        title: "Cargando datos...",
        subtitle: "Consultando base de datos del backend. Espera un momento."
    };
}

async function withLoading(task, copy) {
    state.loading.activeRequests += 1;
    if (!state.loading.timer && !state.loading.visible) {
        state.loading.timer = window.setTimeout(() => {
            state.loading.timer = null;
            if (state.loading.activeRequests > 0) showLoading();
        }, 450);
    }
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

async function loadMapsConfig() {
    try {
        const config = await fetchWithErrors(`${API_BASE}/maps-config`);
        state.mapsConfig = {
            loaded: true,
            enabled: Boolean(config.enabled && config.browserApiKey),
            browserApiKey: String(config.browserApiKey || ""),
            origin: String(config.origin || DISTRIBUTION_ORIGIN.address),
            originName: String(config.originName || DISTRIBUTION_ORIGIN.name),
            missing: Array.isArray(config.missing) ? config.missing : []
        };
    } catch (error) {
        state.mapsConfig = {
            ...state.mapsConfig,
            loaded: true,
            enabled: false,
            missing: ["endpoint /maps-config"]
        };
        setStatus(`Modulo de mapas en mantenimiento: ${error.message}`);
    }
    renderGraph();
    renderSummary();
}

function loadGoogleMapsScript() {
    if (window.google?.maps) return Promise.resolve();
    if (state.googleMapsScriptPromise) return state.googleMapsScriptPromise;
    if (!state.mapsConfig.browserApiKey) {
        return Promise.reject(new Error("Falta GOOGLE_MAPS_BROWSER_API_KEY."));
    }

    state.googleMapsScriptPromise = new Promise((resolve, reject) => {
        const callbackName = `initVrpGoogleMaps${Date.now()}`;
        const script = document.createElement("script");
        const params = new URLSearchParams({
            key: state.mapsConfig.browserApiKey,
            callback: callbackName,
            loading: "async",
            language: "es"
        });

        window[callbackName] = () => {
            delete window[callbackName];
            resolve();
        };
        script.onerror = () => {
            delete window[callbackName];
            reject(new Error("No se pudo cargar Maps JavaScript API."));
        };
        script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
        script.async = true;
        document.head.appendChild(script);
    });

    return state.googleMapsScriptPromise;
}

function decodePolyline(encoded) {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates = [];

    while (index < encoded.length) {
        let result = 0;
        let shift = 0;
        let byte = null;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);

        result = 0;
        shift = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);

        coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }

    return coordinates;
}

function refreshRouteSelects() {
    const prevGraphValue = refs.graphRouteSelect.value;
    const prevAdjustValue = refs.adjustRouteSelect.value;
    const prevMobileValue = refs.mobileRouteSelect?.value || prevGraphValue;

    refs.graphRouteSelect.innerHTML = "";
    refs.adjustRouteSelect.innerHTML = "";
    if (refs.mobileRouteSelect) refs.mobileRouteSelect.innerHTML = "";

    refs.graphRouteSelect.add(new Option("Selecciona ruta", ""));
    refs.adjustRouteSelect.add(new Option("Selecciona ruta", ""));
    refs.adjustRouteSelect.add(new Option("Todas las rutas", ALL_ROUTES_VALUE));
    if (refs.mobileRouteSelect) refs.mobileRouteSelect.add(new Option("Selecciona ruta", ""));

    state.routes.forEach((item) => {
        const label = getRouteOptionLabel(item);
        refs.graphRouteSelect.add(new Option(label, item.route));
        refs.adjustRouteSelect.add(new Option(label, item.route));
        if (refs.mobileRouteSelect) refs.mobileRouteSelect.add(new Option(label, item.route));
    });

    if (state.routes.some((item) => item.route === prevGraphValue)) {
        refs.graphRouteSelect.value = prevGraphValue;
    }
    if (state.routes.some((item) => item.route === prevAdjustValue)) {
        refs.adjustRouteSelect.value = prevAdjustValue;
    }
    if (refs.mobileRouteSelect && state.routes.some((item) => item.route === prevMobileValue)) {
        refs.mobileRouteSelect.value = prevMobileValue;
    } else if (refs.mobileRouteSelect) {
        refs.mobileRouteSelect.value = refs.graphRouteSelect.value;
    }
    syncMobileRouteHeader();
}

async function loadInitialData() {
    if (API_BASE.includes("TU-BACKEND")) {
        setStatus("Configura la URL del backend: agrega ?api=https://tu-backend.onrender.com/api");
        return;
    }
    try {
        const routesPayload = await apiGet("/routes");
        state.routes = routesPayload.routes || [];
        state.totalClients = state.routes.reduce((sum, item) => sum + Number(item.totalClients || 0), 0);
        state.totalAdjust = state.routes
            .filter((item) => /revisar manualmente|revisar|manual|sin ruta/i.test(String(item.routeName || item.route || "")))
            .reduce((sum, item) => sum + Number(item.totalClients || 0), 0);

        refreshRouteSelects();
        state.nodes = [];
        state.edges = [];
        state.optimizedRoute = null;
        setExportButtonsDisabled(true);
        state.sourceMode = "backend";
        setStatus("Datos iniciales cargados. Selecciona una ruta y presiona Actualizar ruta.");
    } catch (error) {
        setStatus(`No se pudo conectar al backend: ${error.message}`);
    }

    renderAll();
}

function applyOptimizedResult(result) {
    state.optimizedRoute = result;
    state.graphCalculationError = "";
    const nodes = [{
        id: "ORIGEN",
        name: state.mapsConfig.originName || DISTRIBUTION_ORIGIN.name,
        priority: 5,
        address: result.origin
    }];
    const edges = [];
    let previousId = "ORIGEN";

    result.sequence.forEach((client, index) => {
        const nodeId = `C${String(index + 1).padStart(3, "0")}`;
        nodes.push({
            id: nodeId,
            name: client.name || client.clientId,
            priority: 3,
            ...client
        });
        edges.push({
            id: `${previousId}__${nodeId}`,
            origin: previousId,
            destination: nodeId,
            weight: Math.max(1, Math.round((client.legDistanceMeters || 0) / 1000)),
            metricValue: Number(client.legDistanceMeters || 0),
            distanceText: client.legDistanceText,
            durationText: client.legDurationText
        });
        previousId = nodeId;
    });

    state.nodes = nodes;
    state.edges = edges;
    const orderedClients = result.sequence || [];
    const optimizedKeys = new Set(orderedClients.map((client) => client.key));
    const unsequenced = state.mobile.clients.filter((client) => !optimizedKeys.has(client.key));
    if (orderedClients.length) state.mobile.clients = [...orderedClients, ...unsequenced];
    setExportButtonsDisabled(!result.googleMapsUrl);
    renderMobileSheet();
    renderAll();
}

function applyGraphClients(route, clients) {
    state.graphCalculationError = "";
    const nodes = [{
        id: "ORIGEN",
        name: state.mapsConfig.originName || DISTRIBUTION_ORIGIN.name,
        priority: 5,
        address: state.mapsConfig.origin || DISTRIBUTION_ORIGIN.address,
        route
    }];
    const edges = [];
    let previousId = "ORIGEN";

    clients.forEach((client, index) => {
        const nodeId = `C${String(index + 1).padStart(3, "0")}`;
        nodes.push({
            id: nodeId,
            name: client.nombre_o_razon_social || client.name || client.clientId,
            priority: 3,
            ...client
        });
        edges.push({
            id: `${previousId}__${nodeId}`,
            origin: previousId,
            destination: nodeId,
            weight: index + 1,
            metricValue: index + 1,
            distanceText: "Pendiente",
            durationText: "Pendiente"
        });
        previousId = nodeId;
    });

    state.nodes = nodes;
    state.edges = edges;
    state.optimizedRoute = null;
    setExportButtonsDisabled(true);
    renderAll();
}

function markGraphCalculationError(message) {
    state.graphCalculationError = message;
    state.optimizedRoute = null;
    state.edges = state.edges.map((edge) => ({
        ...edge,
        distanceText: "Error",
        durationText: "Ver detalle"
    }));
    setExportButtonsDisabled(true);
    renderAll();
}

async function loadGraphClientsForRoute() {
    const route = refs.graphRouteSelect.value;
    state.optimizedRoute = null;
    state.graphCalculationError = "";
    state.nodes = [];
    state.edges = [];
    state.mobile.clients = [];
    state.mobile.selectedClientKey = "";
    setExportButtonsDisabled(true);
    syncMobileRouteHeader();
    if (!route) {
        renderMobileSheet();
        renderAll();
        setStatus("Selecciona una ruta para cargar sus direcciones.");
        return;
    }

    try {
        const payload = await apiGet(`/clients?route=${encodeURIComponent(route)}`);
        const allClients = extractClients(payload);
        state.mobile.clients = allClients;
        renderMobileSheet();
        const clients = allClients.filter((client) => String(client.address || "").trim());
        applyGraphClients(route, clients);
        setStatus(`${getRouteDisplay(route)}: ${clients.length} direcciones cargadas. Calculando distancias con Google Maps...`);
        await optimizeCurrentRoute({ auto: true });
    } catch (error) {
        renderAll();
        setStatus(`Error cargando direcciones de la ruta: ${error.message}`);
    }
}

async function optimizeCurrentRoute(options = {}) {
    const route = refs.graphRouteSelect.value;
    const origin = state.mapsConfig.origin || DISTRIBUTION_ORIGIN.address;
    if (!route) {
        setStatus("Selecciona una ruta para actualizar.");
        return;
    }
    if (!state.mapsConfig.enabled) {
        renderGraph();
        setStatus("Modulo de mapas en mantenimiento: faltan claves de Google Maps.");
        return;
    }

    try {
        const payload = await apiSend("/optimize-route", {
            method: "POST",
            body: JSON.stringify({ route, origin })
        });
        applyOptimizedResult(payload.optimized);
        setStatus(`Ruta ${getRouteDisplay(route)} actualizada: ${payload.optimized.totalDistanceKm} km, ${payload.optimized.totalDurationText || "tiempo no disponible"}.`);
    } catch (error) {
        markGraphCalculationError(error.message);
        const prefix = options.auto ? "No se pudo calcular automaticamente" : "Error al actualizar la ruta";
        setStatus(`${prefix}: ${error.message}`);
    }
}

function exportOptimizedRouteToGoogleMaps() {
    const url = state.optimizedRoute?.googleMapsUrl;
    if (!url) {
        setStatus("Primero actualiza una ruta para generar el link de Google Maps.");
        return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    if (state.mobile.active) {
        openMobileSheet();
    }
}

function showMobileView(viewName) {
    state.mobile.view = viewName;
    const views = {
        route: refs.mobileRouteView,
        sheet: refs.mobileSheetView,
        detail: refs.mobileDetailView
    };
    Object.entries(views).forEach(([name, element]) => {
        if (element) element.classList.toggle("is-active", name === viewName);
    });
}

function renderMobileSheet() {
    if (!refs.mobileClientList) return;
    syncMobileRouteHeader();
    if (!state.mobile.clients.length) {
        refs.mobileClientList.innerHTML = `<div class="mobile-empty-state">No hay entregas cargadas.</div>`;
        return;
    }
    refs.mobileClientList.innerHTML = state.mobile.clients.map((client) => {
        const delivered = Boolean(client.delivered);
        return `
            <button class="mobile-client-row" type="button" data-mobile-client="${encodeURIComponent(client.key)}">
                <span>${escapeHtml(client.nombre_o_razon_social || client.name || client.clientId || "Cliente")}</span>
                <strong class="mobile-delivery-badge ${delivered ? "is-delivered" : "is-pending"}">
                    ${delivered ? "Entregado" : "Por entregar"}
                </strong>
            </button>
        `;
    }).join("");
}

function renderMobileDetail(client) {
    if (!client || !refs.mobileProductsList) return;
    const detail = Array.isArray(client.detail) ? client.detail : [];
    if (refs.mobileDetailClient) {
        refs.mobileDetailClient.textContent = client.nombre_o_razon_social || client.name || client.clientId || "Cliente";
    }
    const productRows = detail.length
        ? detail.map((item) => `
            <div class="mobile-product-row">
                <span>${escapeHtml(getProductName(item))}</span>
                <strong>${escapeHtml(getProductQuantity(item))}</strong>
            </div>
        `).join("")
        : `<div class="mobile-empty-state">Sin productos registrados.</div>`;
    const deliveredBaskets = getClientDeliveredBaskets(client);
    refs.mobileProductsList.innerHTML = `
        ${productRows}
        <div class="mobile-product-row mobile-product-row--baskets">
            <span>Cestas</span>
            <label class="mobile-baskets-input-wrap">
                <input id="mobile-delivered-baskets-input" type="text" inputmode="numeric" pattern="[0-9]*"
                    autocomplete="off" value="${escapeHtml(deliveredBaskets)}" aria-label="Cantidad de cestas entregadas" />
            </label>
        </div>
    `;
    if (refs.mobileDeliveredBtn) {
        refs.mobileDeliveredBtn.disabled = Boolean(client.delivered);
        refs.mobileDeliveredBtn.textContent = "Entregado";
    }
}

function openMobileSheet() {
    if (!state.mobile.clients.length) {
        setStatus("Selecciona una ruta con clientes antes de cargar la hoja.");
        return;
    }
    state.mobile.sheetUnlocked = true;
    if (refs.mobileOpenSheetBtn) refs.mobileOpenSheetBtn.hidden = false;
    renderMobileSheet();
    showMobileView("sheet");
}

function openMobileClientDetail(key) {
    const client = state.mobile.clients.find((item) => item.key === key);
    if (!client) return;
    state.mobile.selectedClientKey = client.key;
    renderMobileDetail(client);
    showMobileView("detail");
}

async function markMobileDeliveryCompleted() {
    const key = state.mobile.selectedClientKey;
    const client = state.mobile.clients.find((item) => item.key === key);
    if (!client || client.delivered) return;
    const basketsInput = document.getElementById("mobile-delivered-baskets-input");
    const deliveredBaskets = Math.max(0, Math.trunc(toNumber(sanitizeNumericValue(basketsInput?.value), 0)));
    try {
        await apiSend(`/deliveries/${encodeURIComponent(key)}`, {
            method: "PUT",
            body: JSON.stringify({ delivered: true, deliveredBaskets })
        });
        const applyDelivery = (item) => item.key === key ? { ...item, delivered: true, deliveredBaskets } : item;
        state.mobile.clients = state.mobile.clients.map(applyDelivery);
        state.nodes = state.nodes.map(applyDelivery);
        if (state.optimizedRoute?.sequence) {
            state.optimizedRoute.sequence = state.optimizedRoute.sequence.map(applyDelivery);
        }
        renderMobileSheet();
        renderGraph();
        showMobileView("sheet");
    } catch (error) {
        setStatus(`No se pudo guardar la entrega: ${error.message}`);
    }
}

function applyMobileDriverMode() {
    const active = isMobileDriverDevice();
    state.mobile.active = active;
    document.body.classList.toggle("mobile-driver-mode", active);
    if (active && refs.mobileGraphSlot && refs.graphStage.parentElement !== refs.mobileGraphSlot) {
        refs.mobileGraphSlot.appendChild(refs.graphStage);
        showMobileView(state.mobile.view);
    }
    if (!active && refs.desktopGraphSlot && refs.graphStage.parentElement !== refs.desktopGraphSlot) {
        refs.desktopGraphSlot.appendChild(refs.graphStage);
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
    const clients = state.clients || [];
    const hasLoadedAllClients = clients.length > 0;

    if (refs.metricClients) {
        refs.metricClients.textContent = String(hasLoadedAllClients ? clients.length : state.totalClients || 0);
    }

    // `metricRoutes`: count of routes excluding manual/review or 'todas las rutas'
    if (refs.metricRoutes && Array.isArray(state.routes)) {
        const excludedPattern = /revisar|manual|todas/gi;
        const validRoutes = state.routes.filter((r) => !excludedPattern.test(String(r.route || "")));
        refs.metricRoutes.textContent = String(validRoutes.length);
    }

    // `metricAdjust`: clients WITHOUT a route assigned OR marked 'revisar manualmente'
    if (refs.metricAdjust) {
        if (hasLoadedAllClients) {
            const pattern = /revisar manualmente|revisar|revisar manual|manualmente/gi;
            const withoutRouteOrReview = clients.filter((c) => {
                const r = String(c.route || c.ruta || c.routeId || c.assignedRoute || c.ruta_asignada || "").trim();
                if (r === "") return true;
                return pattern.test(r);
            });
            refs.metricAdjust.textContent = String(withoutRouteOrReview.length);
        } else {
            refs.metricAdjust.textContent = String(state.totalAdjust || 0);
        }
    }

    // Backwards-compatible small cards
    if (refs.metricNodes) refs.metricNodes.textContent = String(state.nodes.length);
    if (refs.metricEdges) refs.metricEdges.textContent = String(state.edges.length);
    if (refs.metricPriority) refs.metricPriority.textContent = String(
        state.nodes.reduce((max, node) => Math.max(max, toNumber(node.priority, 0)), 0)
    );
    if (refs.nodesCount) refs.nodesCount.textContent = `${state.nodes.length} nodos`;
    if (refs.edgesCount) refs.edgesCount.textContent = `${state.edges.length} rutas`;
}

function isClientBadData(client) {
    const name = String(client.name || client.nombre || client.nombre_o_razon_social || "").trim();
    const address = String(client.address || client.direccion || "").trim();
    const lat = Number(client.lat ?? client.latitude ?? client.y ?? NaN);
    const lng = Number(client.lng ?? client.longitude ?? client.x ?? NaN);
    if (!name || !address) return true;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;
    return false;
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
    if (refs.downloadErrorsXlsxBtn) {
        refs.downloadErrorsXlsxBtn.style.display = state.adjustMode === "errors" ? "inline-flex" : "none";
    }
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
    const selectedRoute = String(refs.adjustRouteSelect?.value || "");
    const enforceRoute = selectedRoute && selectedRoute !== ALL_ROUTES_VALUE;

    state.clientsInAdjustTable = source.filter((client) => {
        if (enforceRoute && normalizeTextForMatch(client.route) !== normalizeTextForMatch(selectedRoute)) return false;
        const clientTransport = String(client.transport || "").trim().toLowerCase();
        if (transport !== "all" && clientTransport !== transport) return false;
        if (!query) return true;
        const haystack = [
            client.clientId,
            client.nombre_o_razon_social,
            client.name,
            client.address,
            client.route,
            client.routeName,
            client.routeDisplayName,
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
    let clients = [];
    if (route === ALL_ROUTES_VALUE) {
        const payload = await apiGet("/clients");
        clients = extractClients(payload);
        state.clients = clients;
    } else {
        const payload = await apiGet(`/clients?route=${encodeURIComponent(route)}`);
        clients = extractClients(payload);
    }

    // Fallback defensivo: si el filtro exacto en backend falla por formato de texto,
    // trae todo y filtra en frontend por ruta normalizada.
    if (!clients.length && route !== ALL_ROUTES_VALUE) {
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
    setStatus(`Ruta ${getRouteDisplay(route)}: ${state.adjustClientsRaw.length} clientes cargados.`);
}

function exportCurrentErrorsToXlsx() {
    if (typeof XLSX === "undefined") {
        setStatus("No se pudo exportar: libreria XLSX no disponible.");
        return;
    }
    applyAdjustFilters();
    if (!state.clientsInAdjustTable.length) {
        setStatus("No hay datos para exportar con los filtros actuales.");
        return;
    }

    const rows = state.clientsInAdjustTable.map((client) => ({
        cliente: client.clientId || "",
        nombre_o_razon_social: client.nombre_o_razon_social || client.name || "",
        direccion: client.address || "",
        ruta: client.routeDisplayName || client.routeName || client.route || "",
        transporte: client.transport || "",
        error: getClientErrorLabel(client)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Errores");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    XLSX.writeFile(workbook, `errores-filtrados-${stamp}.xlsx`);
    setStatus(`XLSX generado con ${rows.length} filas.`);
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

    const routeOptions = [
        ...(state.routes || []).map((item) => ({
            value: String(item.route || "").trim(),
            label: item.displayName || item.routeName || item.route
        })),
        {
            value: String(client?.route || "").trim(),
            label: client?.routeDisplayName || client?.routeName || client?.route
        }
    ].filter((item) => item.value);
    const uniqueRouteOptions = Array.from(
        new Map(routeOptions.map((item) => [item.value, item])).values()
    ).sort((a, b) => String(a.label || "").localeCompare(String(b.label || "")));

    const transportOptions = Array.from(
        new Set(
            [
                ...(state.adjustClientsRaw || []).map((item) => String(item.transport || "").trim()),
                ...(state.clientsInAdjustTable || []).map((item) => String(item.transport || "").trim()),
                String(client?.transport || "").trim()
            ].filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b));

    refs.adjustClientRoute.innerHTML = uniqueRouteOptions
        .map((route) => `<option value="${route.value}">${route.label}</option>`)
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
    const total = state.nodes.length || 1;
    const positions = new Map();
    if (total === 1) {
        positions.set(state.nodes[0].id, { x: GRAPH_BOUNDS.width / 2, y: GRAPH_BOUNDS.height / 2 });
        return positions;
    }

    state.nodes.forEach((node, index) => {
        const left = 76;
        const right = GRAPH_BOUNDS.width - 76;
        const x = left + ((right - left) * index) / Math.max(total - 1, 1);
        const y = index === 0
            ? GRAPH_BOUNDS.height / 2
            : (index % 2 === 1 ? 132 : GRAPH_BOUNDS.height - 132);
        positions.set(node.id, { x, y });
    });

    return positions;
}

function renderMaintenanceGraph() {
    const missing = state.mapsConfig.missing?.length ? `Falta: ${state.mapsConfig.missing.join(", ")}` : "Esperando configuracion de Google Maps.";
    refs.graphStage.innerHTML = `
        <div class="graph-maintenance" role="status">
            <div>
                <strong>En mantenimiento...</strong>
                <span>${missing}</span>
            </div>
        </div>
    `;
    setExportButtonsDisabled(true);
}

function clearGoogleMapLayers() {
    state.googleMapLayers.forEach((layer) => layer.setMap(null));
    state.googleMapLayers = [];
}

async function renderGoogleRouteMap() {
    if (!state.optimizedRoute?.polyline) return;
    try {
        await loadGoogleMapsScript();
        const mapEl = document.getElementById("google-route-map");
        if (!mapEl) return;
        const path = decodePolyline(state.optimizedRoute.polyline);
        if (!path.length) return;

        const map = new google.maps.Map(mapEl, {
            center: path[0],
            zoom: 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true
        });
        state.googleMap = map;
        clearGoogleMapLayers();

        const bounds = new google.maps.LatLngBounds();
        path.forEach((point) => bounds.extend(point));

        const routeLine = new google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: "#c06e32",
            strokeOpacity: 0.95,
            strokeWeight: 6,
            map
        });
        state.googleMapLayers.push(routeLine);

        const originMarker = new google.maps.Marker({
            position: path[0],
            map,
            label: "S",
            title: state.mapsConfig.originName || DISTRIBUTION_ORIGIN.name
        });
        state.googleMapLayers.push(originMarker);

        const destinationMarker = new google.maps.Marker({
            position: path[path.length - 1],
            map,
            label: "F",
            title: "Ultima parada"
        });
        state.googleMapLayers.push(destinationMarker);

        (state.optimizedRoute.sequence || []).forEach((stop) => {
            const location = stop.location;
            if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng))) return;
            const marker = new google.maps.Marker({
                position: { lat: Number(location.lat), lng: Number(location.lng) },
                map,
                label: String(stop.stopNumber || ""),
                title: stop.nombre_o_razon_social || stop.name || `Parada ${stop.stopNumber}`
            });
            state.googleMapLayers.push(marker);
        });

        map.fitBounds(bounds);
    } catch (error) {
        setStatus(`No se pudo mostrar el mapa: ${error.message}`);
    }
}

function renderGraph() {
    if (!state.mapsConfig.enabled && !state.nodes.length) {
        renderMaintenanceGraph();
        return;
    }
    if (!state.nodes.length) {
        refs.graphStage.innerHTML = `<div class="empty-state">Selecciona una ruta y presiona Actualizar ruta.</div>`;
        return;
    }
    const positions = getNodePositions();
    const maxWeight = state.edges.reduce((max, edge) => Math.max(max, getEdgeMetric(edge)), 1);
    const minWeight = state.edges.reduce((min, edge) => Math.min(min, getEdgeMetric(edge)), maxWeight);
    const edgesSvg = state.edges
        .map((edge) => {
            const origin = positions.get(edge.origin);
            const destination = positions.get(edge.destination);
            if (!origin || !destination) return "";
            const midX = (origin.x + destination.x) / 2;
            const midY = (origin.y + destination.y) / 2;
            const edgeColor = getEdgeColor(getEdgeMetric(edge), minWeight, maxWeight);
            const edgeLabel = getEdgeLabel(edge);
            return `
                <g>
                    <line x1="${origin.x}" y1="${origin.y}" x2="${destination.x}" y2="${destination.y}"
                        stroke="${edgeColor}" stroke-width="5" stroke-linecap="round" />
                    <g transform="translate(${midX} ${midY})">
                        <rect x="-54" y="-20" width="108" height="38" rx="9" fill="rgba(255,255,255,0.92)" stroke="rgba(95,70,52,0.18)"></rect>
                        <text x="0" y="-4" fill="#1f2937" font-size="12" font-weight="900" text-anchor="middle">${escapeHtml(edgeLabel.distance)}</text>
                        <text x="0" y="12" fill="#5f4634" font-size="11" font-weight="800" text-anchor="middle">${escapeHtml(edgeLabel.duration)}</text>
                    </g>
                </g>
            `;
        })
        .join("");
    const nodesSvg = state.nodes
        .map((node) => {
            const position = positions.get(node.id);
            if (!position) return "";
            const radius = node.id === "ORIGEN" ? 30 : 26;
            const label = truncateText(node.nombre_o_razon_social || node.name || node.id, node.id === "ORIGEN" ? 18 : 24);
            const labelY = position.y < GRAPH_BOUNDS.height / 2 ? position.y - radius - 12 : position.y + radius + 24;
            return `
                <g class="graph-node" data-node-id="${node.id}">
                    <circle cx="${position.x}" cy="${position.y}" r="${radius}" fill="#fff8ed" stroke="#c06e32" stroke-width="3"></circle>
                    <circle cx="${position.x}" cy="${position.y}" r="${Math.max(8, radius - 12)}" fill="rgba(192,110,50,0.14)"></circle>
                    <text x="${position.x}" y="${position.y + 5}" fill="#000000" font-size="13" font-weight="900" text-anchor="middle">${node.id === "ORIGEN" ? "PDT" : node.stopNumber || node.rowNumber || ""}</text>
                    <text x="${position.x}" y="${labelY}" fill="#111111" font-size="12" font-weight="900" text-anchor="middle">${escapeHtml(label)}</text>
                </g>
            `;
        })
        .join("");
    const errorHtml = state.graphCalculationError
        ? `<div class="graph-error-banner">No se pudo calcular con Google Maps: ${escapeHtml(state.graphCalculationError)}</div>`
        : "";
    refs.graphStage.innerHTML = `
        <svg viewBox="${-GRAPH_BOUNDS.paddingX} ${-GRAPH_BOUNDS.paddingY} ${GRAPH_BOUNDS.width + (GRAPH_BOUNDS.paddingX * 2)} ${GRAPH_BOUNDS.height + (GRAPH_BOUNDS.paddingY * 2)}" role="img" aria-label="Grafo de rutas de distribucion" preserveAspectRatio="xMidYMid meet">
            <g id="graph-viewport" transform="translate(${state.graphView.translateX} ${state.graphView.translateY}) scale(${state.graphView.scale})">
                ${edgesSvg}
                ${nodesSvg}
            </g>
        </svg>
        ${errorHtml}
        <div id="graph-popup-dismiss-layer" class="graph-popup-dismiss-layer" style="display:none;position:fixed;"></div>
        <div id="graph-node-popup" class="graph-node-popup" style="display:none;position:fixed;"></div>
    `;
    syncGraphViewportTransform();
    bindGraphNodeHover();
}

function bindGraphNodeHover() {
    const svg = refs.graphStage.querySelector("svg");
    if (!svg) return;

    svg.querySelectorAll(".graph-node").forEach((el) => {
        const showPopup = (event) => {
            const nodeId = el.getAttribute("data-node-id");
            const node = state.nodes.find((item) => item.id === nodeId);
            if (!node) return;
            const popup = document.getElementById("graph-node-popup");
            popup.innerHTML = `<div class="graph-node-popup-card">
                <strong>${escapeHtml(node.nombre_o_razon_social || node.name || node.id)}</strong>
                <span><b>Cliente:</b> ${escapeHtml(node.clientId || node.id)}</span>
                <span><b>Direccion:</b> ${escapeHtml(node.address || "-")}</span>
                <span><b>Productos:</b> ${escapeHtml(getClientProductSummary(node))}</span>
                <span><b>Transporte:</b> ${escapeHtml(node.transport || node.tipo_transporte || "-")}</span>
            </div>`;
            const dismissLayer = document.getElementById("graph-popup-dismiss-layer");
            if (dismissLayer && state.mobile.active && event.type !== "mouseenter") {
                dismissLayer.style.display = "block";
            }
            popup.style.display = "block";
            const left = Math.max(12, Math.min(event.clientX + 18, window.innerWidth - 342));
            const top = Math.max(12, Math.min(event.clientY - 18, window.innerHeight - 210));
            popup.style.left = `${left}px`;
            popup.style.top = `${top}px`;
        };
        el.addEventListener("mouseenter", (event) => {
            if (state.mobile.active) return;
            showPopup(event);
        });
        el.addEventListener("click", (event) => {
            event.stopPropagation();
            showPopup(event);
        });
        el.addEventListener("pointerup", (event) => {
            if (!state.mobile.active || state.graphView.isPinching) return;
            event.stopPropagation();
            showPopup(event);
        });

        el.addEventListener("mouseleave", () => {
            if (state.mobile.active) return;
            hideGraphNodePopup();
        });
    });
}

function hideGraphNodePopup() {
    const popup = document.getElementById("graph-node-popup");
    if (popup) popup.style.display = "none";
    const dismissLayer = document.getElementById("graph-popup-dismiss-layer");
    if (dismissLayer) dismissLayer.style.display = "none";
}

function getEdgeColor(weight, minWeight, maxWeight) {
    if (maxWeight === minWeight) {
        return "rgb(37, 99, 235)";
    }

    const ratio = (weight - minWeight) / (maxWeight - minWeight);
    const start = { r: 37, g: 99, b: 235 };
    const end = { r: 220, g: 38, b: 38 };
    const r = Math.round(start.r + (end.r - start.r) * ratio);
    const g = Math.round(start.g + (end.g - start.g) * ratio);
    const b = Math.round(start.b + (end.b - start.b) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
}

function getEdgeMetric(edge) {
    const metric = Number(edge.metricValue ?? 0);
    if (Number.isFinite(metric) && metric > 0) return metric;
    return Math.max(1, toNumber(edge.weight, 1));
}

function getEdgeLabel(edge) {
    if (edge.distanceText === "Error") {
        return { distance: "Error", duration: "Ver detalle" };
    }
    const meters = Number(edge.metricValue || 0);
    const distance = Number.isFinite(meters) && meters > 0 && edge.distanceText !== "Pendiente"
        ? `${(meters / 1000).toFixed(2)} km`
        : "Calculando";
    return {
        distance,
        duration: edge.durationText && edge.durationText !== "Pendiente" ? edge.durationText : "Google Maps"
    };
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
    const maxX = 420 + Math.max(0, (GRAPH_BOUNDS.width * (scale - 1)) / 2);
    const maxY = 260 + Math.max(0, (GRAPH_BOUNDS.height * (scale - 1)) / 2);
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

function getGraphPointFromClient(clientX, clientY) {
    const svg = refs.graphStage?.querySelector("svg");
    if (!svg) return { x: GRAPH_BOUNDS.width / 2, y: GRAPH_BOUNDS.height / 2 };
    const rect = svg.getBoundingClientRect();
    return {
        x: ((clientX - rect.left) / rect.width) * GRAPH_BOUNDS.width,
        y: ((clientY - rect.top) / rect.height) * GRAPH_BOUNDS.height
    };
}

function getPointerPair() {
    return Array.from(state.graphView.activePointers.values()).slice(0, 2);
}

function getPointerDistance(first, second) {
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function getPointerMidpoint(first, second) {
    return {
        clientX: (first.clientX + second.clientX) / 2,
        clientY: (first.clientY + second.clientY) / 2
    };
}

function startGraphPinch() {
    const [first, second] = getPointerPair();
    if (!first || !second) return;
    const midpoint = getPointerMidpoint(first, second);
    const anchor = getGraphPointFromClient(midpoint.clientX, midpoint.clientY);
    state.graphView.isPinching = true;
    state.graphView.isDragging = false;
    state.graphView.pinchStartDistance = Math.max(1, getPointerDistance(first, second));
    state.graphView.pinchStartScale = state.graphView.scale;
    state.graphView.pinchAnchorX = anchor.x;
    state.graphView.pinchAnchorY = anchor.y;
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
        const svg = refs.graphStage.querySelector("svg");
        if (!svg) return;
        event.preventDefault();
        if (state.mobile.active && !event.target.closest(".graph-node")) {
            hideGraphNodePopup();
        }
        state.graphView.activePointers.set(event.pointerId, {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY
        });
        try {
            refs.graphStage.setPointerCapture(event.pointerId);
        } catch (_) {}

        if (state.mobile.active && state.graphView.activePointers.size >= 2) {
            startGraphPinch();
            refs.graphStage.classList.add("is-dragging");
            return;
        }

        state.graphView.isDragging = true;
        state.graphView.dragStartX = event.clientX;
        state.graphView.dragStartY = event.clientY;
        state.graphView.startTranslateX = state.graphView.translateX;
        state.graphView.startTranslateY = state.graphView.translateY;
        refs.graphStage.classList.add("is-dragging");
    });

    refs.graphStage.addEventListener("pointermove", (event) => {
        if (state.graphView.activePointers.has(event.pointerId)) {
            state.graphView.activePointers.set(event.pointerId, {
                pointerId: event.pointerId,
                clientX: event.clientX,
                clientY: event.clientY
            });
        }
        if (state.graphView.isPinching && state.graphView.activePointers.size >= 2) {
            event.preventDefault();
            const [first, second] = getPointerPair();
            const distance = Math.max(1, getPointerDistance(first, second));
            const ratio = distance / Math.max(1, state.graphView.pinchStartDistance);
            setGraphScale(
                state.graphView.pinchStartScale * ratio,
                state.graphView.pinchAnchorX,
                state.graphView.pinchAnchorY
            );
            return;
        }
        if (!state.graphView.isDragging) return;
        event.preventDefault();
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
        try {
            if (event && refs.graphStage.hasPointerCapture(event.pointerId)) {
                refs.graphStage.releasePointerCapture(event.pointerId);
            }
        } catch (_) {}
        if (event) state.graphView.activePointers.delete(event.pointerId);
        if (state.graphView.activePointers.size < 2) {
            state.graphView.isPinching = false;
        }
        if (state.graphView.activePointers.size === 0) {
            state.graphView.isDragging = false;
            refs.graphStage.classList.remove("is-dragging");
        }
    };

    refs.graphStage.addEventListener("pointerup", stopDragging);
    refs.graphStage.addEventListener("pointercancel", stopDragging);
    refs.graphStage.addEventListener("pointerleave", stopDragging);

    const closePopupFromOutsideTap = (event) => {
        if (!state.mobile.active) return;
        const target = event.target;
        if (target?.closest?.(".graph-node") || target?.closest?.(".graph-node-popup")) return;
        hideGraphNodePopup();
    };
    refs.graphStage.addEventListener("pointerdown", (event) => {
        if (event.target?.id === "graph-popup-dismiss-layer") {
            event.preventDefault();
            hideGraphNodePopup();
        }
    });
    document.addEventListener("pointerdown", closePopupFromOutsideTap, true);
    document.addEventListener("touchstart", closePopupFromOutsideTap, { passive: true, capture: true });
    document.addEventListener("click", closePopupFromOutsideTap, true);
}

function renderSummary() {
    if (!refs.summaryHub || !refs.summaryShortest || !refs.summaryLongest || !refs.summaryTotal) return;
    if (state.optimizedRoute) {
        refs.summaryHub.textContent = state.mapsConfig.originName || DISTRIBUTION_ORIGIN.name;
        refs.summaryLongest.textContent = state.optimizedRoute.totalDurationText || "-";
        refs.summaryShortest.textContent = `${state.optimizedRoute.totalDistanceKm || 0} km`;
        refs.summaryTotal.textContent = String(state.optimizedRoute.totalClients || 0);
        return;
    }
    refs.summaryHub.textContent = state.mapsConfig.originName || DISTRIBUTION_ORIGIN.name;
    refs.summaryShortest.textContent = state.edges.length ? "Pendiente" : "-";
    refs.summaryLongest.textContent = state.edges.length ? "Pendiente" : "-";
    refs.summaryTotal.textContent = String(Math.max(0, state.nodes.length - 1));
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
    document.querySelectorAll("[data-return-menu]").forEach((button) => {
        button.addEventListener("click", openMainMenu);
    });

    bindIfExists(refs.optimizeRouteBtn, "click", optimizeCurrentRoute);
    bindIfExists(refs.exportGoogleMapsBtn, "click", exportOptimizedRouteToGoogleMaps);
    bindIfExists(refs.graphRouteSelect, "change", () => loadGraphClientsForRoute());
    bindIfExists(refs.mobileOptimizeRouteBtn, "click", optimizeCurrentRoute);
    bindIfExists(refs.mobileExportGoogleMapsBtn, "click", exportOptimizedRouteToGoogleMaps);
    bindIfExists(refs.mobileOpenSheetBtn, "click", openMobileSheet);
    bindIfExists(refs.mobileSheetBackBtn, "click", () => showMobileView("route"));
    bindIfExists(refs.mobileDetailBackBtn, "click", () => showMobileView("sheet"));
    bindIfExists(refs.mobileDeliveredBtn, "click", markMobileDeliveryCompleted);
    bindIfExists(refs.mobileProductsList, "input", (event) => {
        if (event.target?.id === "mobile-delivered-baskets-input") {
            event.target.value = sanitizeNumericValue(event.target.value);
        }
    });
    bindIfExists(refs.mobileRouteSelect, "change", () => {
        refs.graphRouteSelect.value = refs.mobileRouteSelect.value;
        state.mobile.sheetUnlocked = false;
        if (refs.mobileOpenSheetBtn) refs.mobileOpenSheetBtn.hidden = true;
        syncMobileRouteHeader();
        loadGraphClientsForRoute();
    });
    bindIfExists(refs.mobileClientList, "click", (event) => {
        const row = event.target.closest("[data-mobile-client]");
        if (!row) return;
        openMobileClientDetail(decodeURIComponent(row.dataset.mobileClient));
    });
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
    bindIfExists(refs.downloadErrorsXlsxBtn, "click", exportCurrentErrorsToXlsx);
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
    applyMobileDriverMode();
    bindEvents();
    bindGraphInteractions();
    updateAdjustModeButtons();
    loadMapsConfig();
    loadInitialData();
    window.addEventListener("resize", applyMobileDriverMode);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
