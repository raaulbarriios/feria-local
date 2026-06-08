/**
 * LÓGICA DE CONTROL DEL PANEL DE ADMINISTRACIÓN GENERAL (Administrador)
 * Gestiona el acceso de superusuario, creación/actualización de credenciales de casetas en Cloudflare,
 * edición completa de información, etiquetas globales de la feria y normalización de la base de datos en Firebase Firestore.
 */

import { db, auth } from './firebase-config.js';
import { doc, getDoc, setDoc, updateDoc, deleteField, collection, getDocs, query, where, deleteDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, inMemoryPersistence } from "firebase/auth";

// --- HELPERS BÁSICOS ---
// Selecciona un elemento por su ID
const $ = id => document.getElementById(id);

// Normaliza el número de caseta al formato estándar 'pXX' (ej: '5' -> 'p05', 'p9' -> 'p09')
const normalizeId = n => 'p' + n.toLowerCase().trim().replace(/^p/, '').padStart(2, '0');

// Obtiene el usuario autenticado actualmente en Firebase con una promesa resoluble
const getCurrentUser = () => new Promise(res => {
    if (auth.currentUser) return res(auth.currentUser);
    const unsub = onAuthStateChanged(auth, u => { unsub(); res(u); });
});

// Etiquetas globales predefinidas que actúan como fallback
let PREDEFINED_TAGS = ["Pública", "Privada", "Tradicional", "Moderna", "Familiar", "Juvenil", "Comida", "Copas", "Conciertos"];

document.addEventListener('DOMContentLoaded', () => {
    // Referencias principales del DOM para secciones y cuadros de diálogo/notificación
    const [loginSec, panelSec, errorBox, statusBox] = ['loginSection', 'panelSection', 'errorBox', 'statusBox'].map($);
    const [numIn, nomIn, corIn, passIn] = ['numCaseta', 'nombreCaseta', 'correo', 'password'].map($);
    
    // Lista de días de la feria actualizados para soportar Día 28 de forma global
    const FERIA_DIAS = ["Día 20", "Día 21", "Día 22", "Día 23", "Día 24", "Día 25", "Día 26", "Día 27", "Día 28"];
    let currentSchedule = {}, activeEditDay = "Día 20", currentCasetaData = null;

    /**
     * Alterna la visualización del login o del panel de administración principal.
     * Limpia los inputs al salir del panel por razones de seguridad.
     */
    const toggleView = isPanel => {
        loginSec.style.setProperty('display', isPanel ? 'none' : 'flex', 'important');
        panelSec.style.setProperty('display', isPanel ? 'flex' : 'none', 'important');
        if (!isPanel) $('userInput').value = $('passInput').value = '';
        window.scrollTo({ top: 0, behavior: 'instant' });
    };

    /**
     * Muestra notificaciones flotantes de éxito o error.
     */
    const showStatus = (msg, type) => {
        statusBox.textContent = msg; statusBox.className = `statusNotif ${type}`;
        statusBox.style.display = 'block'; setTimeout(() => statusBox.style.display = 'none', 3000);
    };

    // Comprueba si hay una sesión activa de Firebase
    const checkSession = () => auth.currentUser !== null;
    toggleView(false);

    // --- CONTROLADOR DE PESTAÑAS DEL ADMINISTRADOR ---
    // Gestiona la visibilidad entre las pestañas Credenciales, Editar e Información
    const tabs = [
        { btn: $('tabAdminCreds'), content: $('tabContentCreds') },
        { btn: $('tabAdminInfo'), content: $('tabContentInfo') },
        { btn: $('tabAdminTags'), content: $('tabContentTags') }
    ];
    tabs.forEach(t => {
        if (t.btn && t.content) {
            t.btn.onclick = () => {
                tabs.forEach(x => { x.btn?.classList.remove('active'); x.content?.classList.remove('active'); });
                t.btn.classList.add('active'); t.content.classList.add('active');
                window.scrollTo({ top: 0, behavior: 'instant' });
            };
        }
    });

    /**
     * Dibuja los badges interactivos de etiquetas para asociar a la caseta en edición.
     */
    const renderPredefinedTags = () => {
        const container = $('tagsContainer');
        if (!container) return;
        container.innerHTML = PREDEFINED_TAGS.map(t => `<div class="tag-badge" data-tag="${t}"><span>${t}</span></div>`).join('');
        container.querySelectorAll('.tag-badge').forEach(badge => {
            badge.onclick = () => {
                badge.classList.toggle('selected');
                $('panelEtiquetas').value = Array.from(container.querySelectorAll('.tag-badge.selected')).map(b => b.getAttribute('data-tag')).join(', ');
            };
        });
    };

    /**
     * Sincroniza el estado visual de los badges de etiquetas a partir de la cadena de texto de la base de datos.
     */
    const syncTagBadges = () => {
        const container = $('tagsContainer');
        if (!container) return;
        const selected = $('panelEtiquetas').value.split(',').map(s => s.trim().toLowerCase());
        container.querySelectorAll('.tag-badge').forEach(b => {
            b.classList.toggle('selected', selected.includes(b.getAttribute('data-tag').toLowerCase()));
        });
    };

    /**
     * Renderiza la lista global de etiquetas configurables en la tercera pestaña de administración.
     */
    const renderCredsTagsList = () => {
        const listCont = $('credsTagsList');
        if (!listCont) return;
        if (PREDEFINED_TAGS.length === 0) {
            listCont.innerHTML = `<div class="schedule-empty" style="width: 100%; text-align: center;"><i class="fas fa-tags"></i> No hay etiquetas globales configuradas.</div>`;
            return;
        }
        listCont.innerHTML = PREDEFINED_TAGS.map((t, idx) => `
            <div class="tag-badge edit-mode">
                <span>${t}</span><span class="delete-tag-inline" data-index="${idx}"><i class="fas fa-times"></i></span>
            </div>
        `).join('');
        listCont.querySelectorAll('.delete-tag-inline').forEach(btn => {
            btn.onclick = e => {
                e.stopPropagation(); PREDEFINED_TAGS.splice(parseInt(btn.getAttribute('data-index'), 10), 1);
                renderCredsTagsList(); renderPredefinedTags(); syncTagBadges();
            };
        });
    };

    /**
     * Carga de manera dinámica las etiquetas de feria predefinidas desde Firebase.
     */
    const loadGlobalTags = async () => {
        try {
            const docSnap = await getDoc(doc(db, "feria", "etiquetas"));
            if (docSnap.exists() && Array.isArray(docSnap.data().predefinidas)) PREDEFINED_TAGS = docSnap.data().predefinidas;
            renderCredsTagsList(); renderPredefinedTags(); syncTagBadges();
        } catch (e) { console.error(e); }
    };

    /**
     * Construye dinámicamente las pestañas de selección de días del editor (Días 20 a 28).
     */
    const renderDayTabs = () => {
        const tabsCont = $('modal-dia-tabs');
        if (!tabsCont) return;
        tabsCont.innerHTML = '';
        FERIA_DIAS.forEach(day => {
            const btn = document.createElement('button');
            btn.type = 'button'; btn.className = `modal-dia-tab-btn${day === activeEditDay ? ' active' : ''}`;
            btn.textContent = day;
            btn.onclick = () => { activeEditDay = day; renderDayTabs(); renderScheduleList(); };
            tabsCont.appendChild(btn);
        });
    };

    /**
     * Dibuja los eventos (actividades y horas) correspondientes al día seleccionado actualmente en el editor.
     */
    const renderScheduleList = () => {
        const listContainer = $('scheduleList');
        if (!listContainer) return;
        const dayEvents = currentSchedule[activeEditDay] || [];
        if (dayEvents.length === 0) {
            listContainer.innerHTML = `<div class="schedule-empty"><i class="fas fa-calendar-times"></i> No hay eventos programados para el ${activeEditDay}.</div>`;
            return;
        }
        listContainer.innerHTML = dayEvents.map((item, idx) => `
            <div class="schedule-item">
                <div class="schedule-item-info">
                    <span class="schedule-item-time">${item.hora}</span><span class="schedule-item-activity">${item.actividad || item.descripcion || ''}</span>
                </div>
                <button type="button" class="delete-event-inline" data-index="${idx}"><i class="fas fa-trash-alt"></i></button>
            </div>
        `).join('');
        listContainer.querySelectorAll('.delete-event-inline').forEach(btn => {
            btn.onclick = () => { dayEvents.splice(parseInt(btn.getAttribute('data-index'), 10), 1); renderScheduleList(); };
        });
    };

    /**
     * Comprime de forma proporcional una imagen local y la convierte a cadena Base64 (JPEG, calidad 70%)
     * para facilitar la visualización inmediata y reducir la carga de ancho de banda.
     */
    const compressAndGetBase64 = (file, maxWidth = 800, maxHeight = 600) => new Promise((res, rej) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = ev => {
            const img = new Image();
            img.src = ev.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let [w, h] = [img.width, img.height];
                if (w > h) {
                    if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
                } else {
                    if (h > maxHeight) { w = Math.round((w * maxHeight) / h); h = maxHeight; }
                }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                res(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = rej;
        };
        reader.onerror = rej;
    });

    // Controla la subida e inspección de dimensiones de imágenes (bloquea las fotos verticales)
    $('panelImagen').onchange = e => {
        window.imageDeletedFlag = false;
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = evt => {
                const img = new Image();
                img.src = evt.target.result;
                img.onload = () => {
                    if (img.height > img.width) {
                        showStatus('Las imágenes en formato vertical no están permitidas. Por favor, sube una imagen horizontal.', 'error');
                        $('panelImagen').value = ''; $('imagenPreview').src = ''; $('imagenPreview').style.display = 'none';
                        if ($('eliminarImagenBtn')) $('eliminarImagenBtn').style.display = 'none';
                        window.imageDeletedFlag = true; return;
                    }
                    $('imagenPreview').src = evt.target.result; $('imagenPreview').style.display = 'block';
                    if ($('eliminarImagenBtn')) $('eliminarImagenBtn').style.display = 'block';
                };
            };
            reader.readAsDataURL(file);
        }
    };

    // Resetea y marca como eliminada la portada actual de la caseta
    $('eliminarImagenBtn')?.addEventListener('click', () => {
        $('panelImagen').value = ''; $('imagenPreview').src = ''; $('imagenPreview').style.display = 'none';
        $('eliminarImagenBtn').style.display = 'none'; window.imageDeletedFlag = true;
    });

    // --- ACCESO LOGIN SUPERADMINISTRADOR (Acceso REST exclusivo en Firebase) ---
    $('adminLoginForm')?.addEventListener('submit', async e => {
        e.preventDefault(); errorBox.style.display = 'none';
        const [email, pass] = [$('userInput').value.trim(), $('passInput').value.trim()];
        const btn = e.target.querySelector('.btnSubmit');
        const orig = btn.innerHTML; btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> VERIFICANDO...';
        try {
            await setPersistence(auth, inMemoryPersistence);
            // Autenticación inicial de credenciales
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ACCEDIENDO AL PANEL...';
            // Valida los permisos leyendo un documento exclusivo de administradores (regla estricta Firestore)
            await getDoc(doc(db, "admin_only", "verificar"));
            toggleView(true);
        } catch (err) {
            await signOut(auth);
            const msg = (err.code === 'permission-denied' || err.message.includes("permission-denied") || err.message.includes("exclusivo"))
                ? 'Este correo no tiene acceso al panel de administración.' : 'Acceso denegado. Verifica las credenciales.';
            errorBox.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${msg}`; errorBox.style.display = 'block';
        } finally {
            btn.disabled = false; btn.innerHTML = orig;
        }
    });

    // --- CONTROLADOR DE BÚSQUEDA DE CASETA EN TIEMPO REAL ---
    numIn.addEventListener('input', async () => {
        if (!checkSession()) return toggleView(false);
        const num = numIn.value.trim();
        if (!num) {
            nomIn.value = corIn.value = passIn.value = $('panelDescripcion').value = $('panelEtiquetas').value = $('imagenPreview').src = '';
            $('imagenPreview').style.display = 'none'; if ($('eliminarImagenBtn')) $('eliminarImagenBtn').style.display = 'none';
            currentSchedule = {}; renderScheduleList(); syncTagBadges(); $('tabAdminInfo').classList.add('disabled'); return;
        }
        try {
            const snap = await getDoc(doc(db, "feria", normalizeId(num)));
            if (snap.exists()) {
                const d = snap.data(); currentCasetaData = d; nomIn.value = d.nombre || '';
                corIn.value = ''; corIn.placeholder = "Buscando propietario...";
                
                // Carga la cuenta vinculada del propietario buscando en la colección 'usuario'
                try {
                    const userSnap = await getDocs(query(collection(db, "usuario"), where("casetaId", "==", normalizeId(num))));
                    if (!userSnap.empty) {
                        corIn.value = userSnap.docs[0].data().email || '';
                    } else {
                        const oid = d.ownerId || '';
                        corIn.value = (oid && oid.includes('@')) ? oid : ''; corIn.placeholder = "ejemplo@correo.com";
                    }
                } catch (err) {
                    corIn.value = ''; corIn.placeholder = "Error al buscar propietario";
                }
                passIn.value = ''; $('panelDescripcion').value = d.descripcion || '';
                $('panelEtiquetas').value = Array.isArray(d.etiquetas) ? d.etiquetas.join(', ') : (d.etiqueta || '');
                syncTagBadges();

                const imgSrc = d.portada_url || d.imagen;
                if (imgSrc) {
                    $('imagenPreview').src = imgSrc; $('imagenPreview').style.display = 'block';
                    if ($('eliminarImagenBtn')) $('eliminarImagenBtn').style.display = 'block';
                } else {
                    $('imagenPreview').src = ''; $('imagenPreview').style.display = 'none';
                    if ($('eliminarImagenBtn')) $('eliminarImagenBtn').style.display = 'none';
                }
                window.imageDeletedFlag = false;
                currentSchedule = Object.fromEntries(FERIA_DIAS.map(d => [d, []]));
                activeEditDay = "Día 20";

                // Mapeo e importación de la agenda de días (normaliza Día 20 a Día 28)
                const prog = d.programacion || d.eventos;
                if (prog && typeof prog === 'object' && !Array.isArray(prog)) {
                    Object.keys(prog).forEach(day => {
                        let dayKey = day; const numMatch = day.match(/\d+/);
                        if (numMatch) {
                            const dayNum = numMatch[0];
                            if (dayNum >= 20 && dayNum <= 28) dayKey = `Día ${dayNum}`;
                        }
                        if (Array.isArray(prog[day])) currentSchedule[dayKey] = [...prog[day]];
                    });
                } else if (Array.isArray(prog)) {
                    currentSchedule["Día 20"] = [...prog];
                }
                renderDayTabs(); renderScheduleList(); $('tabAdminInfo').classList.remove('disabled');
            } else {
                nomIn.value = corIn.value = passIn.value = $('panelDescripcion').value = $('panelEtiquetas').value = $('imagenPreview').src = '';
                $('imagenPreview').style.display = 'none'; if ($('eliminarImagenBtn')) $('eliminarImagenBtn').style.display = 'none';
                window.imageDeletedFlag = false; currentSchedule = {}; renderScheduleList(); syncTagBadges(); $('tabAdminInfo').classList.add('disabled');
            }
        } catch (e) { console.error(e); }
    });

    // --- ACCIÓN: ACTUALIZAR CREDENCIALES ---
    // Guarda el acceso actualizando directamente en la base de datos local
    $('saveAction').addEventListener('click', async () => {
        if (!checkSession()) return toggleView(false);
        const [num, nom, cor, pass] = [numIn, nomIn, corIn, passIn].map(i => i.value.trim());
        if (!num || !nom || !cor) return showStatus("Completa los campos requeridos", "error");
        
        const saveBtn = $('saveAction'), origContent = saveBtn.innerHTML;
        saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        try {
            if (pass) {
                showStatus("Contraseñas no se pueden editar en local. Cambie en Firebase Console", "error");
            }

            // Limpia y elimina relaciones duplicadas previas asociadas a esta caseta
            const oldUserSnap = await getDocs(query(collection(db, "usuario"), where("casetaId", "==", normalizeId(num))));
            for (const oldDoc of oldUserSnap.docs) {
                await deleteDoc(doc(db, "usuario", oldDoc.id));
            }

            // Actualiza la vinculación de propietario y limpia rastros legados de ownerEmail en el documento de feria
            await setDoc(doc(db, "feria", normalizeId(num)), { nombre: nom, ownerId: cor, ownerEmail: deleteField() }, { merge: true });
            showStatus("Actualizado", "success"); passIn.value = '';
        } catch (e) { 
            showStatus("Error: " + e.message, "error");
        } finally {
            saveBtn.disabled = false; saveBtn.innerHTML = origContent;
        }
    });

    // --- ACCIÓN: GUARDAR ETIQUETAS PREDEFINIDAS GLOBALES ---
    $('saveGlobalTagsAction')?.addEventListener('click', async () => {
        if (!checkSession()) return toggleView(false);
        try {
            await setDoc(doc(db, "feria", "etiquetas"), { predefinidas: PREDEFINED_TAGS });
            showStatus("Etiquetas globales guardadas", "success");
        } catch (e) { showStatus("Error: " + e.message, "error"); }
    });

    // --- ACCIÓN: GUARDAR INFORMACIÓN Y EVENTOS ---
    $('editForm').addEventListener('submit', async e => {
        e.preventDefault(); if (!checkSession()) return toggleView(false);
        const num = numIn.value.trim();
        if (!num) return showStatus("Especifique un número de caseta", "error");
        
        const saveBtn = $('panelSaveBtn'), origText = saveBtn.innerHTML;
        saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        try {
            const data = {
                descripcion: $('panelDescripcion').value.trim(),
                etiquetas: $('panelEtiquetas').value.split(',').map(s => s.trim()).filter(s => s),
                programacion: currentSchedule
            };

            // Guarda el Base64 de la imagen comprimida si se ha subido un nuevo archivo
            const file = $('panelImagen').files[0];
            if (file) {
                const b64 = await compressAndGetBase64(file);
                data.imagen = data.portada_url = b64;
            } else if (window.imageDeletedFlag) {
                data.imagen = data.portada_url = deleteField();
            }

            await updateDoc(doc(db, "feria", normalizeId(num)), data);
            showStatus("Información de la caseta guardada correctamente", "success");
        } catch (err) {
            showStatus("Error al guardar información: " + err.message, "error");
        } finally {
            saveBtn.disabled = false; saveBtn.innerHTML = origText;
        }
    });

    // --- ACCIÓN: HABILITAR O DESHABILITAR CASETA EN EL MAPA ---
    const toggleStatus = async isEnable => {
        if (!checkSession()) return toggleView(false);
        const num = numIn.value.trim();
        if (!num) return showStatus("Especifique un número de caseta", "error");
        try {
            await setDoc(doc(db, "feria", normalizeId(num)), { estatus: isEnable }, { merge: true });
            showStatus(`Caseta ${isEnable ? 'habilitada' : 'deshabilitada'} correctamente`, "success");
        } catch (e) { showStatus("Error al cambiar estado", "error"); }
    };

    $('enableAction').addEventListener('click', () => toggleStatus(true));
    $('disableAction').addEventListener('click', () => toggleStatus(false));
    $('logoutBtn').addEventListener('click', async () => { await signOut(auth); toggleView(false); });

    // Resetea credenciales temporales y limpia persistencia al cerrar sesión
    sessionStorage.removeItem('adminSession'); signOut(auth);
    renderPredefinedTags(); renderDayTabs(); loadGlobalTags();

    // --- ACCIÓN: AÑADIR EVENTOS DIARIOS ---
    $('addEventBtn').onclick = () => {
        const horaInp = $('addEventHora'), actInp = $('addEventActividad');
        const horaVal = horaInp.value.trim(), actVal = actInp.value.trim();
        if (!horaVal || !actVal) return showStatus("Rellena hora y actividad", "error");
        
        if (!currentSchedule[activeEditDay]) currentSchedule[activeEditDay] = [];
        currentSchedule[activeEditDay].push({ hora: horaVal, actividad: actVal });
        renderScheduleList(); horaInp.value = actInp.value = '';
    };

    // --- ACCIÓN: CREAR NUEVA ETIQUETA GLOBAL ---
    const handleAddTag = () => {
        const input = $('newTagName'); if (!input) return;
        const val = input.value.trim();
        if (!val) return showStatus("Escribe un nombre para la etiqueta", "error");
        if (PREDEFINED_TAGS.includes(val)) return showStatus("Esta etiqueta ya existe", "error");
        PREDEFINED_TAGS.push(val); input.value = '';
        renderCredsTagsList(); renderPredefinedTags(); syncTagBadges();
    };

    $('addTagBtn').onclick = handleAddTag;
    $('newTagName')?.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } });

    /**
     * MÉTODO AUXILIAR DE NORMALIZACIÓN DE LA BASE DE DATOS
     * Convierte y limpia registros planos antiguos del esquema Firestore a la estructura compacta moderna.
     */
    window.normalizeDatabase = async () => {
        if (!checkSession()) return console.error("Acceso denegado: Sesión requerida");
        try {
            const snaps = await getDocs(collection(db, "feria"));
            let c = 0;
            for (const s of snaps.docs) {
                const d = s.data(), u = {};
                if (d.estatus === undefined || typeof d.estatus === 'string') {
                    let estado = d.estatus !== undefined ? d.estatus : d.status;
                    u.estatus = (estado === 'active' || estado === 'true' || estado === true);
                }
                if (d.status !== undefined) u.status = deleteField();
                if (d.descripcion === undefined) u.descripcion = '';
                if (d.horario !== undefined) u.horario = deleteField();
                if (d.nombre === undefined) u.nombre = '';
                if (d.ownerId === undefined) u.ownerId = '';
                if (d.programacion === undefined) u.programacion = [];
                ['email', 'updatedAt', 'deletedAt', 'deleteAt', 'updateAt', 'password'].forEach(f => {
                    if (d[f] !== undefined) u[f] = deleteField();
                });
                if (Object.keys(u).length > 0) { await updateDoc(s.ref, u); c++; }
            }
            alert(`Proceso finalizado. Casetas normalizadas: ${c}.`);
        } catch (e) { console.error("Fallo normalización:", e); }
    };
});
