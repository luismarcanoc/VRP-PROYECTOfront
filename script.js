const CSV_FALLBACK = `tipo,id_origen,nombre_origen,prioridad_origen,id_destino,nombre_destino,prioridad_destino,peso_ruta
ruta,PLANTA,Planta Bello Campo,5,SUC01,Sucursal Centro,4,12
ruta,PLANTA,Planta Bello Campo,5,SUC02,Sucursal Altamira,3,18
ruta,PLANTA,Planta Bello Campo,5,SUC03,Sucursal Chacao,5,10
ruta,SUC01,Sucursal Centro,4,SUC02,Sucursal Altamira,3,8
ruta,SUC02,Sucursal Altamira,3,SUC03,Sucursal Chacao,5,6
ruta,SUC03,Sucursal Chacao,5,SUC04,Sucursal La California,2,15
ruta,SUC01,Sucursal Centro,4,SUC04,Sucursal La California,2,20
ruta,SUC04,Sucursal La California,2,SUC05,Sucursal Petare,1,9`;

const state = {
    currentPage: "menu",
    nodes: [],
    edges: [],
    selectedNodeId: "",
    sourceMode: "csv",
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
    paddingX: 110,
    paddingY: 110
};

const refs = {
    pages: document.querySelectorAll(".app-page"),
    graphStage: document.getElementById("graph-stage"),
    reloadSample: document.getElementById("reload-sample"),
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
    summaryTotal: document.getElementById("summary-total")
};

function setStatus(message) {
    refs.statusMessage.textContent = message;
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

function parseCsv(csvText) {
    const lines = String(csvText || "")
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);

    if (lines.length <= 1) {
        return { nodes: [], edges: [] };
    }

    const rows = lines.slice(1).map((line) => line.split(","));
    const nodesMap = new Map();
    const edges = [];

    rows.forEach((parts) => {
        const originId = normalizeId(parts[1]);
        const originName = String(parts[2] || "").trim();
        const originPriority = Math.max(1, toNumber(parts[3], 1));
        const destinationId = normalizeId(parts[4]);
        const destinationName = String(parts[5] || "").trim();
        const destinationPriority = Math.max(1, toNumber(parts[6], 1));
        const weight = Math.max(1, toNumber(parts[7], 1));

        if (originId) {
            nodesMap.set(originId, {
                id: originId,
                name: originName || originId,
                priority: originPriority
            });
        }

        if (destinationId) {
            nodesMap.set(destinationId, {
                id: destinationId,
                name: destinationName || destinationId,
                priority: destinationPriority
            });
        }

        if (originId && destinationId) {
            edges.push({
                id: `${originId}__${destinationId}`,
                origin: originId,
                destination: destinationId,
                weight
            });
        }
    });

    return {
        nodes: Array.from(nodesMap.values()),
        edges
    };
}

async function loadInitialData() {
    try {
        const response = await fetch("data/rutas_ejemplo.csv", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csvText = await response.text();
        const parsed = parseCsv(csvText);
        state.nodes = parsed.nodes;
        state.edges = parsed.edges;
        state.sourceMode = "csv";
        setStatus("Datos cargados desde data/rutas_ejemplo.csv.");
    } catch (_) {
        const parsed = parseCsv(CSV_FALLBACK);
        state.nodes = parsed.nodes;
        state.edges = parsed.edges;
        state.sourceMode = "fallback";
        setStatus("Datos cargados desde el respaldo interno. Si sirves el proyecto por HTTP tomara el CSV.");
    }

    renderAll();
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
    refs.metricNodes.textContent = String(state.nodes.length);
    refs.metricEdges.textContent = String(state.edges.length);
    refs.metricPriority.textContent = String(
        state.nodes.reduce((max, node) => Math.max(max, toNumber(node.priority, 0)), 0)
    );
    refs.nodesCount.textContent = `${state.nodes.length} nodos`;
    refs.edgesCount.textContent = `${state.edges.length} rutas`;
}

function renderSelectOptions() {
    const options = state.nodes
        .map((node) => `<option value="${node.id}">${node.id} - ${node.name}</option>`)
        .join("");

    refs.edgeOrigin.innerHTML = `<option value="">Selecciona</option>${options}`;
    refs.edgeDestination.innerHTML = `<option value="">Selecciona</option>${options}`;
}

function renderNodesTable() {
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
            const radius = 22 + node.priority * 3;
            const labelY = position.y + radius + 22;

            return `
                <g>
                    <circle cx="${position.x}" cy="${position.y}" r="${radius}" fill="#fff8ed" stroke="#c06e32" stroke-width="3"></circle>
                    <circle cx="${position.x}" cy="${position.y}" r="${Math.max(8, radius - 12)}" fill="rgba(192,110,50,0.14)"></circle>
                    <text x="${position.x}" y="${position.y + 5}" fill="#000000" font-size="12" font-weight="800" text-anchor="middle">
                        ${node.id}
                    </text>
                    <text x="${position.x}" y="${labelY}" fill="#5f4634" font-size="13" font-weight="700" text-anchor="middle">
                        ${node.name}
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
    `;

    syncGraphViewportTransform();
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

    refs.reloadSample.addEventListener("click", loadInitialData);
    refs.nodeForm.addEventListener("submit", handleNodeSubmit);
    refs.edgeForm.addEventListener("submit", handleEdgeSubmit);

    refs.nodesTableBody.addEventListener("click", (event) => {
        const target = event.target.closest("button");
        if (!target) return;
        if (target.dataset.editNode) fillNodeForm(target.dataset.editNode);
        if (target.dataset.deleteNode) deleteNode(target.dataset.deleteNode);
    });

    refs.edgesTableBody.addEventListener("click", (event) => {
        const target = event.target.closest("button");
        if (!target) return;
        if (target.dataset.editEdge) fillEdgeForm(target.dataset.editEdge);
        if (target.dataset.deleteEdge) deleteEdge(target.dataset.deleteEdge);
    });
}

function init() {
    bindEvents();
    bindGraphInteractions();
    loadInitialData();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
