/**
 * LÓGICA DE CONTROL DEL VISUALIZADOR PÚBLICO (Publico)
 * Gestiona el mapa interactivo de la feria de Algeciras, filtros de búsqueda,
 * filtrado por etiquetas globales, agenda de eventos en tiempo real ("Ahora" y "Destacados")
 * y el zoom y arrastre interactivo (Panzoom) sobre el plano de casetas.
 */

import { db } from './firebase-config.js';
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// --- HELPERS BÁSICOS DE SELECCIÓN DOM ---
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);

document.addEventListener('DOMContentLoaded', () => {
    // Referencias principales del DOM para búsquedas y modales
    const el = {
        overlay: $('#modal-overlay'), 
        close: $('#close-modal'), 
        name: $('#punto-nombre'),
        searchBtn: $('#searchTrigger'), 
        searchInp: $('#manualSearch'),
        mobSearchBtn: $('#toggleMobileSearch'), 
        mobSearchRow: $('#mobileSearchRow'), 
        mobSearchInp: $('#mobileSearchInput'),
        mobActionBtn: $('#mobileSearchAction')
    };

    /**
     * Actualiza y despliega la información detallada de una caseta específica en el modal.
     * Carga eventos clasificados por días (incluyendo soporte para el Día 28), imágenes de portada,
     * descripciones extendidas y etiquetas asociadas.
     * 
     * @param {SVGElement} item - El nodo de polígono SVG correspondiente a la caseta seleccionada.
     */
    const updatePanel = item => {
        // Cierra los inputs de búsqueda activos para liberar el teclado en móviles
        if (el.searchInp) el.searchInp.blur();
        if (el.mobSearchInp) el.mobSearchInp.blur();
        if (el.mobSearchRow?.classList.contains('active')) {
            el.mobSearchRow.classList.remove('active');
            el.mobSearchBtn.classList.remove('active');
            el.mobSearchBtn.setAttribute('aria-expanded', 'false');
            el.mobSearchRow.setAttribute('aria-hidden', 'true');
        }
        setTimeout(() => {
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }
        }, 50);

        // Obtiene los datos en caché de la caseta a partir de su identificador
        const d = window.mapData[item.dataset.id];
        if (!d) return;
        if (el.name) {
            const numStr = d.numero || parseInt(d.id.replace('p', ''));
            el.name.innerHTML = `<span class="modal-caseta-number">${numStr}</span> ${d.nombre || d.id}`;
        }

        // Si la caseta está desactivada por administración, oculta el contenido general y muestra la advertencia
        if (d.estatus === false) {
            el.overlay?.classList.add('modal-desactivada');
        } else {
            el.overlay?.classList.remove('modal-desactivada');
            const p = $('#punto-programacion');
            if (p) p.innerHTML = '';
            const daySelectContainer = $('#modal-dia-select-container');
            const dayTabsContainer = $('#modal-dia-tabs');
            
            if (daySelectContainer) daySelectContainer.style.display = 'none';
            if (dayTabsContainer) dayTabsContainer.innerHTML = '';
            
            /**
             * Renderiza la lista de eventos del día seleccionado en el panel del modal.
             */
            const renderEventsList = (eventsArray) => {
                if (p) {
                    if (eventsArray && eventsArray.length > 0) {
                        p.innerHTML = eventsArray.map(e => {
                            const hora = e.hora || '';
                            const desc = e.actividad || e.descripcion || '';
                            return `<div class="evento-item"><span class="evento-hora">${hora}</span><span class="evento-desc">${desc}</span></div>`;
                        }).join('');
                    } else {
                        p.innerHTML = "<p>No hay eventos programados.</p>";
                    }
                }
            };
            
            // Procesa y formatea el itinerario de eventos de la caseta (admite estructura de array y objeto estructurado)
            const prog = d.programacion || d.eventos || [];
            if (Array.isArray(prog)) {
                renderEventsList(prog);
            } else if (typeof prog === 'object' && prog !== null) {
                const FERIA_DIAS = ["Día 20", "Día 21", "Día 22", "Día 23", "Día 24", "Día 25", "Día 26", "Día 27", "Día 28"];
                let days = [...FERIA_DIAS];
                Object.keys(prog).forEach(day => { if (!days.includes(day)) days.push(day); });
                days.sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0));

                if (days.length > 0) {
                    if (daySelectContainer && dayTabsContainer) {
                        daySelectContainer.style.display = 'block';
                        dayTabsContainer.innerHTML = '';
                        days.forEach((dayName, idx) => {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = `modal-dia-tab-btn${idx === 0 ? ' active' : ''}`;
                            btn.textContent = dayName;
                            btn.addEventListener('click', () => {
                                dayTabsContainer.querySelectorAll('.modal-dia-tab-btn').forEach(b => b.classList.remove('active'));
                                btn.classList.add('active');
                                renderEventsList(prog[dayName]);
                            });
                            dayTabsContainer.appendChild(btn);
                        });
                        renderEventsList(prog[days[0]]);
                    } else {
                        renderEventsList(prog[days[0]]);
                    }
                } else {
                    renderEventsList([]);
                }
            } else {
                renderEventsList([]);
            }

            // Carga la portada/imagen en base64 de la caseta si existe
            const imgEl = $('#punto-imagen');
            if (imgEl) {
                const imgSrc = d.portada_url || d.imagen;
                if (imgSrc && imgSrc.trim() !== '') {
                    imgEl.src = imgSrc.trim(); imgEl.style.display = 'block';
                } else {
                    imgEl.src = ''; imgEl.style.display = 'none';
                }
            }

            // Controla el botón para ver la descripción extendida (info de la caseta)
            const btnDesc = $('#btn-ver-descripcion');
            if (btnDesc) {
                if (d.descripcion && d.descripcion.trim() !== '') {
                    const txtEl = $('#punto-desc-texto');
                    if (txtEl) txtEl.textContent = d.descripcion;
                    const titEl = $('#punto-desc-titulo');
                    if (titEl) titEl.innerHTML = `<i class="fas fa-info-circle" style="color: var(--accentBlue);"></i> Info: ${d.nombre || d.id}`;
                    btnDesc.style.display = 'inline-flex';
                } else {
                    btnDesc.style.display = 'none';
                }
            }

            // Dibuja los tags asociados a la caseta actual
            const tagsEl = $('#punto-etiquetas');
            if (tagsEl) {
                let tags = [];
                if (d.etiquetas) {
                    if (Array.isArray(d.etiquetas)) tags.push(...d.etiquetas);
                    else if (typeof d.etiquetas === 'string' && d.etiquetas.trim() !== '') tags.push(d.etiquetas.trim());
                }
                if (tags.length > 0) {
                    tagsEl.innerHTML = tags.map(t => `<span class="etiqueta-badge">${t}</span>`).join('');
                    tagsEl.style.display = 'flex';
                } else {
                    tagsEl.style.display = 'none'; tagsEl.innerHTML = '';
                }
            }
        }
        el.overlay?.classList.add('active');
        el.overlay?.setAttribute('aria-hidden', 'false');
    };

    // --- ACCIÓN: CERRAR VENTANA MODAL ---
    el.close?.addEventListener('click', () => {
        el.overlay?.classList.remove('active');
        el.overlay?.setAttribute('aria-hidden', 'true');
        const descOverlay = $('#modal-desc-overlay');
        if (descOverlay) {
            descOverlay.classList.remove('active');
            descOverlay.setAttribute('aria-hidden', 'true');
        }
    });

    // Controladores auxiliares para el modal de información extendida
    const descOverlay = $('#modal-desc-overlay'), closeDescBtn = $('#close-desc-modal'), btnVerDesc = $('#btn-ver-descripcion');
    btnVerDesc?.addEventListener('click', () => {
        descOverlay?.classList.add('active'); descOverlay?.setAttribute('aria-hidden', 'false');
    });
    const closeDescModal = () => {
        descOverlay?.classList.remove('active'); descOverlay?.setAttribute('aria-hidden', 'true');
    };
    closeDescBtn?.addEventListener('click', closeDescModal);
    descOverlay?.addEventListener('click', e => { if (e.target === descOverlay) closeDescModal(); });

    // --- SISTEMA DE BÚSQUEDA FLUIDA POR NOMBRE DE CASETA ---
    const search = q => {
        $$('.mapItem').forEach(i => i.classList.remove('highlight-match', 'highlight-tag'));
        if (!q?.trim()) return;
        const normalizeStr = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const n = normalizeStr(q);
        $$('.mapItem').forEach(i => {
            if (normalizeStr(i.dataset.name || '').includes(n)) i.classList.add('highlight-match');
        });
    };

    // Vinculación de eventos de búsqueda (tanto escritorio como móvil)
    [el.searchInp, el.mobSearchInp].forEach(i => {
        i?.addEventListener('input', e => search(e.target.value));
        i?.addEventListener('keypress', e => e.key === 'Enter' && search(e.target.value));
    });
    el.searchBtn?.addEventListener('click', () => search(el.searchInp.value));
    el.mobActionBtn?.addEventListener('click', () => search(el.mobSearchInp.value));

    // Menú de búsqueda móvil flotante
    el.mobSearchBtn?.addEventListener('click', e => {
        e.stopPropagation();
        const a = el.mobSearchRow.classList.toggle('active');
        el.mobSearchBtn.classList.toggle('active');
        el.mobSearchBtn.setAttribute('aria-expanded', a);
        el.mobSearchRow.setAttribute('aria-hidden', !a);
        if (a) setTimeout(() => el.mobSearchInp?.focus(), 100);
    });

    // Cierra la búsqueda móvil al hacer click fuera
    document.addEventListener('click', e => {
        if (el.mobSearchRow?.classList.contains('active') && !el.mobSearchRow.contains(e.target) && !el.mobSearchBtn.contains(e.target)) {
            el.mobSearchRow.classList.remove('active');
            el.mobSearchBtn.classList.remove('active');
            el.mobSearchBtn.setAttribute('aria-expanded', 'false');
            el.mobSearchRow.setAttribute('aria-hidden', 'true');
        }
    });

    // --- CORRECCIÓN DE FOCO EN CONTENEDOR DEL MAPA ---
    const mapWrapperEl = $('.mapWrapper');
    if (mapWrapperEl) {
        mapWrapperEl.addEventListener('focusin', () => {
            setTimeout(() => { mapWrapperEl.scrollLeft = 0; mapWrapperEl.scrollTop = 0; }, 0);
        });
    }

    document.addEventListener('focusin', () => {
        setTimeout(() => {
            document.documentElement.scrollLeft = 0; document.documentElement.scrollTop = 0;
            document.body.scrollLeft = 0; document.body.scrollTop = 0;
        }, 0);
    });

    // --- ACCIÓN: PANELES LATERALES DESLIZANTES EN MÓVIL ---
    const sidePanelLeft = $('#sidePanelLeft'), casetasListLeft = $('#casetasListLeft'), closePanelLeft = $('#closeSidePanelLeft');
    const sidePanelRight = $('#sidePanelRight'), casetasListRight = $('#casetasListRight'), closePanelRight = $('#closeSidePanelRight');
    const tabDestacados = $('#tabDestacados'), tabAhora = $('#tabAhora');
    let activeEventTab = 'destacados';

    const tagsPanel = $('#tagsPanel'), tagsList = $('#tagsList'), closeTagsPanel = $('#closeTagsPanel');
    const tagsTriggers = [$('#tagsTriggerMobile'), $('#tagsTriggerDesktop')];

    /**
     * Alterna de forma segura los cajones o paneles interactivos y maneja relaciones hermanas en móviles.
     */
    const togglePanel = (panel, force, siblings = []) => {
        const isActive = typeof force === 'boolean' ? force : !panel?.classList.contains('active');
        panel?.classList.toggle('active', isActive);
        panel?.setAttribute('aria-hidden', !isActive);
        if (isActive) {
            siblings.forEach(s => {
                s?.classList.remove('active'); s?.setAttribute('aria-hidden', 'true');
            });
        }
    };

    const toggleLeft = force => {
        if (window.innerWidth >= 992) return;
        togglePanel(sidePanelLeft, force, [sidePanelRight, tagsPanel]);
    };
    const toggleRight = force => {
        if (window.innerWidth >= 992) return;
        togglePanel(sidePanelRight, force, [sidePanelLeft, tagsPanel]);
    };
    const toggleTags = force => {
        togglePanel(tagsPanel, force, window.innerWidth < 992 ? [sidePanelLeft, sidePanelRight] : []);
    };

    // Vinculación de manejadores a los botones de menús flotantes
    $('#casetasTriggerMobile')?.addEventListener('click', e => { e.stopPropagation(); toggleLeft(); });
    $('#casetasTriggerDesktop')?.addEventListener('click', e => { e.stopPropagation(); toggleLeft(); });
    closePanelLeft?.addEventListener('click', () => toggleLeft(false));

    $('#eventsTriggerMobile')?.addEventListener('click', e => { e.stopPropagation(); toggleRight(); });
    closePanelRight?.addEventListener('click', () => toggleRight(false));

    tagsTriggers.forEach(t => t?.addEventListener('click', e => { e.stopPropagation(); toggleTags(); }));
    closeTagsPanel?.addEventListener('click', () => toggleTags(false));

    // Cierre rápido con tecla escape
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { toggleLeft(false); toggleRight(false); toggleTags(false); }
    });

    // Control de pestañas del panel lateral de eventos del día
    tabDestacados?.addEventListener('click', () => {
        activeEventTab = 'destacados'; tabDestacados.classList.add('active'); tabAhora?.classList.remove('active'); renderMenuCasetas();
    });
    tabAhora?.addEventListener('click', () => {
        activeEventTab = 'ahora'; tabAhora.classList.add('active'); tabDestacados?.classList.remove('active'); renderMenuCasetas();
    });

    /**
     * Construye dinámicamente una tarjeta interactiva para un evento en los menús de agenda.
     */
    const createEventCard = (e) => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <div class="event-card-header">
                <span class="event-card-time"><i class="far fa-clock"></i> ${e.hora}</span>
            </div>
            <div class="event-card-activity">${e.actividad}</div>
            <div class="event-card-caseta"><i class="fas fa-store-alt"></i> ${e.casetaNumero} - ${e.casetaNombre}</div>
        `;
        card.addEventListener('click', () => {
            const p = $(`polygon[data-id="${e.casetaId}"]`);
            if (p) {
                $$('.mapItem').forEach(item => item.classList.remove('highlight-match', 'highlight-tag'));
                p.classList.add('highlight-match');
            }
            if (window.innerWidth <= 991) {
                toggleLeft(false); toggleRight(false);
            }
        });
        return card;
    };

    /**
     * Renderiza las casetas ordenadas en el panel de navegación izquierdo, 
     * e identifica/filtra eventos activos en la franja horaria actual para el panel derecho ("Ahora").
     */
    const renderMenuCasetas = () => {
        if (!casetasListLeft) return;
        
        // Ordena las casetas numéricamente por su código identificador de forma consistente
        const a = Object.values(window.mapData).sort((x, y) => {
            const numX = parseInt(x.numero || parseInt(x.id.replace('p', '')) || 0);
            const numY = parseInt(y.numero || parseInt(y.id.replace('p', '')) || 0);
            return numX - numY;
        });

        casetasListLeft.innerHTML = '';
        if (casetasListRight) casetasListRight.innerHTML = '';
        if (!a.length) {
            casetasListLeft.innerHTML = '<div class="casetas-dropdown-placeholder">Cargando casetas...</div>'; return;
        }

        // Dibuja los enlaces directos a las casetas del panel lateral izquierdo
        a.forEach(c => {
            const b = document.createElement('button');
            b.className = 'side-panel-item'; b.type = 'button';
            const numStr = c.numero || parseInt(c.id.replace('p', ''));
            b.innerHTML = `<span class="caseta-number-badge">${numStr}</span><span class="caseta-name-text">${c.nombre || `Caseta ${numStr}`}</span>`;
            b.addEventListener('click', () => {
                const p = $(`polygon[data-id="${c.id}"]`);
                if (p) {
                    $$('.mapItem').forEach(item => item.classList.remove('highlight-match', 'highlight-tag'));
                    p.classList.add('highlight-match');
                }
                if (window.innerWidth <= 991) {
                    toggleLeft(false); toggleRight(false);
                }
            });
            casetasListLeft.appendChild(b);
        });

        // Procesa la agenda de eventos para rellenar las pestañas Destacados y "Ahora"
        if (casetasListRight) {
            const allEvents = [];
            a.forEach(c => {
                const prog = c.programacion || c.eventos || [];
                const processEvent = (e) => {
                    const hora = e.hora || '';
                    const actividad = e.actividad || e.descripcion || '';
                    if (actividad) {
                        allEvents.push({
                            casetaId: c.id,
                            casetaNombre: c.nombre || `Caseta ${c.numero || parseInt(c.id.replace('p', ''))}`,
                            casetaNumero: c.numero || parseInt(c.id.replace('p', '')),
                            hora: hora, actividad: actividad
                        });
                    }
                };
                if (Array.isArray(prog)) {
                    prog.forEach(processEvent);
                } else if (typeof prog === 'object' && prog !== null) {
                    const currentDayNum = new Date().getDate();
                    Object.entries(prog).forEach(([dayKey, dayEvents]) => {
                        const dayNumMatch = dayKey.match(/\d+/);
                        // Sincroniza en tiempo real cargando únicamente eventos correspondientes al día del mes actual
                        if (dayNumMatch && parseInt(dayNumMatch[0]) === currentDayNum && Array.isArray(dayEvents)) {
                            dayEvents.forEach(processEvent);
                        }
                    });
                }
            });

            casetasListRight.style.display = 'flex';
            casetasListRight.style.flexDirection = 'column';
            casetasListRight.style.padding = '8px';
            casetasListRight.style.gap = '8px';

            const currentHour = new Date().getHours();
            const hourStr = currentHour < 10 ? '0' + currentHour : currentHour;
            if (tabAhora) tabAhora.innerHTML = `<i class="fas fa-clock"></i> Ahora (${hourStr}:00)`;

            // Pestaña "Destacados": Muestra una selección aleatoria fluida de 4 eventos de la jornada
            if (activeEventTab === 'destacados') {
                casetasListRight.style.overflowY = 'hidden';
                const shuffledEvents = [...allEvents].sort(() => 0.5 - Math.random());
                const randomEvents = shuffledEvents.slice(0, 4);
                if (randomEvents.length) {
                    randomEvents.forEach(e => casetasListRight.appendChild(createEventCard(e)));
                } else {
                    casetasListRight.innerHTML = `<div class="no-events-msg">No hay eventos disponibles hoy.</div>`;
                }
            // Pestaña "Ahora": Filtra y lista eventos que estén programados exactamente durante la hora actual
            } else if (activeEventTab === 'ahora') {
                casetasListRight.style.overflowY = 'auto';
                const currentHourEvents = allEvents.filter(e => {
                    if (!e.hora) return false;
                    const parts = e.hora.split(':');
                    return parts.length > 0 && parseInt(parts[0]) === currentHour;
                });
                if (currentHourEvents.length) {
                    currentHourEvents.forEach(e => casetasListRight.appendChild(createEventCard(e)));
                } else {
                    casetasListRight.innerHTML = `<div class="no-events-msg">No hay eventos programados en esta franja horaria (${hourStr}:00 - ${hourStr}:59).</div>`;
                }
            }
        }
    };

    // --- CONFIGURACIÓN DE PANZOOM (ZOOM Y ARRASTRE MULTI-TOUCH) ---
    const mapContent = $('.mapContent'), mapCont = $('.mapImageContainer');
    let pz;
    
    /**
     * Ajusta la escala mínima y límites de movimiento del mapa en función de las dimensiones 
     * físicas reales del viewport de visualización (Premium responsive layout setup).
     */
    const setupPanzoom = () => {
        if (!mapContent || typeof panzoom === 'undefined') return;
        const img = mapContent.querySelector('.mapImage');
        if (img && !img.complete) return img.onload = setupPanzoom;
        const r = mapCont.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) {
            setTimeout(setupPanzoom, 100); return;
        }
        if (pz) pz.dispose();
        
        const w = 930, h = 1100, sx = r.width / w, sy = r.height / h,
            z = window.innerWidth < 768 ? Math.min(sx, sy) : Math.min(sx, sy) * 0.95;
            
        pz = panzoom(mapContent, { maxZoom: 5, minZoom: z, bounds: true, boundsPadding: 0 });
        pz.on('transform', () => {
            const t = pz.getTransform(), s = t.scale;
            if (s < z) return pz.zoomAbs(0, 0, z);
            let nx = t.x, ny = t.y, cw = w * s, ch = h * s;
            nx = cw <= r.width ? (r.width - cw) / 2 : Math.min(0, Math.max(nx, r.width - cw));
            ny = ch <= r.height ? (r.height - ch) / 2 : Math.min(0, Math.max(ny, r.height - ch));
            if (nx !== t.x || ny !== t.y) pz.moveTo(nx, ny);
        });
        pz.zoomAbs(0, 0, z); pz.moveTo((r.width - w * z) / 2, (r.height - h * z) / 2);
    };

    // --- COORDENADAS PRECISAS SVG DE LAS 56 CASETAS ---
    const PTS = [
        { id: "p01", coords: [813, 735, 855, 724, 868, 786, 823, 795] }, { id: "p02", coords: [723, 751, 811, 734, 823, 795, 735, 811] },
        { id: "p03", coords: [680, 760, 725, 750, 736, 811, 694, 820] }, { id: "p04", coords: [637, 768, 679, 758, 692, 819, 647, 828] },
        { id: "p05", coords: [592, 777, 637, 768, 647, 829, 606, 835] }, { id: "p06", coords: [506, 793, 591, 776, 603, 836, 517, 852] },
        { id: "p07", coords: [757, 680, 843, 665, 855, 724, 767, 741] }, { id: "p08", coords: [670, 697, 757, 682, 767, 741, 680, 759] },
        { id: "p09", coords: [583, 714, 669, 698, 680, 759, 594, 775] }, { id: "p10", coords: [494, 731, 581, 714, 594, 776, 507, 793] },
        { id: "p11", coords: [377, 817, 464, 801, 476, 863, 388, 877] }, { id: "p12", coords: [336, 824, 378, 817, 388, 877, 345, 885] },
        { id: "p13", coords: [291, 833, 333, 824, 345, 885, 301, 893] }, { id: "p14", coords: [202, 849, 290, 834, 301, 893, 215, 910] },
        { id: "p15", coords: [115, 867, 201, 851, 214, 911, 126, 926] }, { id: "p16", coords: [365, 755, 453, 738, 465, 800, 378, 815] },
        { id: "p17", coords: [234, 780, 365, 756, 377, 816, 246, 841] }, { id: "p18", coords: [191, 788, 234, 779, 248, 841, 203, 848] },
        { id: "p19", coords: [103, 805, 192, 788, 201, 848, 117, 865] }, { id: "p20", coords: [773, 528, 816, 518, 833, 602, 789, 610] },
        { id: "p21", coords: [709, 540, 773, 529, 789, 610, 722, 623] }, { id: "p22", coords: [642, 554, 708, 541, 722, 623, 656, 636] },
        { id: "p23", coords: [598, 560, 642, 553, 655, 635, 613, 643] }, { id: "p24", coords: [554, 569, 597, 562, 615, 643, 571, 652] },
        { id: "p25", coords: [509, 577, 555, 569, 569, 652, 525, 660] }, { id: "p26", coords: [468, 586, 510, 579, 524, 660, 482, 668] },
        { id: "p27", coords: [758, 445, 801, 437, 817, 520, 773, 528] }, { id: "p28", coords: [714, 453, 758, 445, 773, 528, 730, 534] },
        { id: "p29", coords: [539, 487, 713, 454, 729, 535, 556, 568] }, { id: "p30", coords: [495, 493, 538, 486, 554, 570, 510, 577] },
        { id: "p31", coords: [452, 502, 495, 493, 511, 579, 469, 585] }, { id: "p32", coords: [338, 609, 426, 593, 442, 677, 354, 692] },
        { id: "p33", coords: [251, 628, 338, 612, 353, 692, 269, 710] }, { id: "p34", coords: [207, 635, 253, 627, 268, 709, 225, 719] },
        { id: "p35", coords: [163, 643, 207, 635, 225, 718, 179, 726] }, { id: "p36", coords: [119, 650, 164, 642, 178, 726, 135, 735] },
        { id: "p37", coords: [75, 659, 118, 653, 136, 734, 91, 742] }, { id: "p38", coords: [324, 527, 411, 509, 426, 592, 340, 608] },
        { id: "p39", coords: [279, 536, 323, 528, 338, 610, 295, 618] }, { id: "p40", coords: [215, 548, 280, 536, 295, 619, 229, 630] },
        { id: "p41", coords: [149, 559, 216, 546, 229, 629, 165, 642] }, { id: "p42", coords: [105, 568, 150, 559, 165, 643, 120, 649] },
        { id: "p43", coords: [60, 576, 106, 569, 119, 650, 77, 658] }, { id: "p44", coords: [736, 330, 779, 321, 793, 383, 750, 390] },
        { id: "p45", coords: [693, 339, 735, 331, 748, 391, 706, 400] }, { id: "p46", coords: [648, 348, 694, 337, 706, 401, 661, 409] },
        { id: "p47", coords: [561, 363, 650, 347, 661, 409, 573, 424] }, { id: "p48", coords: [474, 380, 562, 363, 573, 424, 486, 440] },
        { id: "p49", coords: [430, 390, 472, 379, 485, 440, 440, 450] }, { id: "p50", coords: [682, 276, 769, 261, 782, 323, 693, 337] },
        { id: "p51", coords: [593, 294, 682, 276, 695, 339, 606, 356] }, { id: "p52", coords: [550, 301, 595, 294, 606, 355, 562, 363] },
        { id: "p53", coords: [485, 316, 549, 303, 562, 363, 498, 376] }, { id: "p54", coords: [418, 327, 426, 363, 469, 356, 474, 380, 498, 375, 484, 314] },
        { id: "p55", coords: [426, 364, 431, 387, 474, 379, 469, 357] }, { id: "p56", coords: [303, 414, 390, 395, 402, 456, 314, 473] }
    ];

    window.mapData = {};
    const mapEl = $('#eventMap');
    let drag = false, sx = 0, sy = 0;

    // --- DETECTOR DE ARRASTRE PARA EVITAR CLICKS INCORRECTOS ---
    if (mapCont) {
        mapCont.addEventListener('mousedown', e => {
            drag = false; sx = e.clientX; sy = e.clientY;
            if (el.searchInp) el.searchInp.blur(); if (el.mobSearchInp) el.mobSearchInp.blur();
        }, true);
        mapCont.addEventListener('mousemove', e => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) drag = true; }, true);
        mapCont.addEventListener('touchstart', e => {
            drag = false; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
            if (el.searchInp) el.searchInp.blur(); if (el.mobSearchInp) el.mobSearchInp.blur();
        }, { passive: true, capture: true });
        mapCont.addEventListener('touchmove', e => { if (Math.abs(e.touches[0].clientX - sx) > 10 || Math.abs(e.touches[0].clientY - sy) > 10) drag = true; }, { passive: true, capture: true });
    }

    // --- FILTRADO AVANZADO POR ETIQUETAS ---
    let activeTags = [];
    const renderTagsMenu = () => {
        if (!tagsList) return;
        const counts = {};
        
        // Contabiliza el número total de casetas activas por etiqueta
        Object.values(window.mapData).forEach(d => {
            if (d.estatus !== false) {
                let tgs = [];
                if (d.etiquetas) {
                    if (Array.isArray(d.etiquetas)) tgs.push(...d.etiquetas);
                    else if (typeof d.etiquetas === 'string' && d.etiquetas.trim() !== '') tgs.push(d.etiquetas.trim());
                }
                tgs.forEach(t => {
                    const lowT = t.trim().toLowerCase(); counts[lowT] = (counts[lowT] || 0) + 1;
                });
            }
        });

        tagsList.innerHTML = Object.keys(counts).length ? '' : '<div class="casetas-dropdown-placeholder">No hay etiquetas...</div>';

        // Opción: Ver todas
        if (Object.keys(counts).length) {
            const allBtn = document.createElement('button');
            allBtn.className = `tag-filter-item ${activeTags.length === 0 ? 'active' : ''}`;
            allBtn.innerHTML = `<span><i class="fas fa-layer-group" style="margin-right:8px; opacity:0.8;"></i>Todas</span><span class="tag-filter-count">${Object.values(window.mapData).filter(d => d.estatus !== false).length}</span>`;
            allBtn.addEventListener('click', () => {
                activeTags = []; $$('.mapItem').forEach(item => item.classList.remove('highlight-match', 'highlight-tag'));
                renderTagsMenu(); if (window.innerWidth <= 991) toggleTags(false);
            });
            tagsList.appendChild(allBtn);
        }

        // Renderiza cada botón de etiqueta dinámicamente
        Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
            const b = document.createElement('button');
            const isSelected = activeTags.includes(tag);
            b.className = `tag-filter-item ${isSelected ? 'active' : ''}`;
            b.innerHTML = `<span><i class="fas fa-tag" style="margin-right:8px; opacity:0.8;"></i>${tag}</span><span class="tag-filter-count">${count}</span>`;
            b.addEventListener('click', () => {
                if (activeTags.includes(tag)) {
                    activeTags = activeTags.filter(t => t !== tag);
                } else {
                    activeTags.push(tag);
                }

                // Aplica realce visual (highlight) en el mapa SVG a las casetas correspondientes
                $$('.mapItem').forEach(item => item.classList.remove('highlight-tag'));
                if (activeTags.length > 0) {
                    Object.values(window.mapData).forEach(d => {
                        if (d.estatus === false) return;
                        let hasTag = false;
                        if (d.etiquetas) {
                            let itemTags = [];
                            if (Array.isArray(d.etiquetas)) {
                                itemTags = d.etiquetas.map(t => t.trim().toLowerCase());
                            } else if (typeof d.etiquetas === 'string') {
                                itemTags = [d.etiquetas.trim().toLowerCase()];
                            }
                            hasTag = itemTags.some(t => activeTags.includes(t));
                        }
                        if (hasTag) {
                            const p = $(`polygon[data-id="${d.id}"]`);
                            if (p) p.classList.add('highlight-tag');
                        }
                    });
                }
                renderTagsMenu();
            });
            tagsList.appendChild(b);
        });
    };

    /**
     * Dibuja dinámicamente los polígonos interactivos SVG sobre el plano del mapa de feria.
     */
    const render = () => {
        if (!mapEl) return;
        mapEl.innerHTML = "";
        Object.values(window.mapData).forEach(d => {
            if (!d.coords || d.coords.length < 6) return;
            const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            p.setAttribute("points", d.coords.reduce((a, c, i) => a + c + (i % 2 ? ',' : ' '), '').trim());
            p.setAttribute("class", "mapItem" + (d.estatus === false ? " caseta-desactivada" : "")); p.setAttribute("data-id", d.id);
            if (d.nombre) p.setAttribute("data-name", d.nombre);
            const t = document.createElementNS("http://www.w3.org/2000/svg", "title");
            t.textContent = d.nombre || d.id; p.appendChild(t);
            
            // Administra las acciones de click directo sobre los polígonos de casetas
            const handlePolygonClick = (e) => {
                if (drag) return;
                if (e?.type === 'touchend') e.preventDefault();
                updatePanel(p); p.classList.remove('highlight-match');
            };
            p.addEventListener('click', handlePolygonClick);
            p.addEventListener('touchend', handlePolygonClick);
            mapEl.appendChild(p);
        });
        renderMenuCasetas(); renderTagsMenu();
    };

    // --- CONEXIÓN FIREBASE FIRESTORE EN TIEMPO REAL ---
    try {
        onSnapshot(collection(db, "feria"), sn => {
            window.mapData = {}; PTS.forEach(p => window.mapData[p.id] = { ...p });
            sn?.forEach(d => {
                const id = d.id;
                if (id !== "etiquetas") {
                    window.mapData[id] = { ...(window.mapData[id] || {}), ...d.data(), id };
                }
            });
            render();
            // Despliega automáticamente los menús en dispositivos de escritorio
            if (window.innerWidth >= 992) {
                sidePanelLeft?.classList.add('active'); sidePanelLeft?.setAttribute('aria-hidden', 'false');
                sidePanelRight?.classList.add('active'); sidePanelRight?.setAttribute('aria-hidden', 'false');
            }
        });
    } catch (e) {
        // Fallback local robusto en caso de corte en la conexión a la base de datos
        PTS.forEach(p => window.mapData[p.id] = { ...p }); render();
        if (window.innerWidth >= 992) {
            sidePanelLeft?.classList.add('active'); sidePanelLeft?.setAttribute('aria-hidden', 'false');
            sidePanelRight?.classList.add('active'); sidePanelRight?.setAttribute('aria-hidden', 'false');
        }
    }

    setupPanzoom();
    let resizeTimer;
    // Maneja con debounce la responsividad táctil al cambiar las dimensiones de la pantalla
    window.addEventListener('resize', () => {
        setupPanzoom(); clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            renderMenuCasetas();
            if (window.innerWidth >= 992) {
                sidePanelLeft?.classList.add('active'); sidePanelLeft?.setAttribute('aria-hidden', 'false');
                sidePanelRight?.classList.add('active'); sidePanelRight?.setAttribute('aria-hidden', 'false');
            } else {
                sidePanelRight?.classList.remove('active'); sidePanelRight?.setAttribute('aria-hidden', 'true');
            }
        }, 150);
    });
});
