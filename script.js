/**
 * LÓGICA DE CONTROL DEL PANEL PRIVADO DE CASETAS (Casetero)
 * Gestiona el control de acceso del casetero, la autenticación reforzada por doble factor (2FA)
 * mediante Cloudflare Workers, la edición interactiva de datos de la caseta,
 * etiquetado local y el planificador dinámico de eventos diarios (Día 20 al Día 28).
 */
import { db, auth, WORKER_URL } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, setPersistence, inMemoryPersistence } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteField } from "firebase/firestore";

// --- 1. CONFIGURACIÓN Y MAPEADO DE REFERENCIAS AL DOM ---
const $ = id => document.getElementById(id);
const views = { login: $('loginView'), panel: $('panelView') };
const form = {
    login: $('loginForm'), mail: $('loginCorreo'), pass: $('loginPassword'), btn: $('loginSubmitBtn'), err: $('loginErrorMsg'),
    edit: $('editForm'), num: $('panelNumero'), nom: $('panelNombre'), desc: $('panelDescripcion'),
    img: $('panelImagen'), imgPrev: $('imagenPreview'), previewCont: $('previewContainer'), removeImg: $('removeImageBtn'), tags: $('panelEtiquetas'), save: $('panelSaveBtn'), msg: $('panelStatusMsg')
};

// Fallback robusto de etiquetas predefinidas para asociar a la caseta
let PREDEFINED_TAGS = ["Pública", "Privada", "Tradicional", "Moderna", "Familiar", "Juvenil", "Comida", "Copas", "Conciertos"];

/**
 * Renderiza los botones interactivos (badges) de etiquetas asociables en el panel.
 */
const renderPredefinedTags = () => {
    const container = $('tagsContainer');
    if (!container) return;
    container.innerHTML = PREDEFINED_TAGS.map(t => `<div class="tag-badge" data-tag="${t}"><span>${t}</span></div>`).join('');
    container.querySelectorAll('.tag-badge').forEach(b => {
        b.onclick = () => {
            b.classList.toggle('selected');
            form.tags.value = Array.from(container.querySelectorAll('.tag-badge.selected')).map(el => el.dataset.tag).join(', ');
        };
    });
};

/**
 * Sincroniza la apariencia visual activa de los badges según los datos recuperados de la BD.
 */
const syncTagBadges = () => {
    const container = $('tagsContainer');
    if (!container) return;
    const selected = form.tags.value.split(',').map(s => s.trim().toLowerCase());
    container.querySelectorAll('.tag-badge').forEach(b => {
        b.classList.toggle('selected', selected.includes(b.dataset.tag.toLowerCase()));
    });
};

/**
 * Modifica la vista actual de la interfaz y limpia la posición del scroll de pantalla.
 */
const show = view => {
    views.login.classList.toggle('active', view === 'login');
    views.panel.classList.toggle('active', view === 'panel');
    document.body.className = `view-${view}`;
    window.scrollTo({ top: 0, behavior: 'instant' });
};

/**
 * Muestra advertencias o avisos emergentes sobre el estado del panel.
 */
const showMsg = (txt, ok) => {
    form.msg.innerHTML = `<i class="fas fa-${ok ? 'check' : 'exclamation'}-circle"></i> ${txt}`;
    form.msg.className = `statusMsg ${ok ? 'success' : 'error'}`;
    form.msg.style.display = 'block';
    setTimeout(() => form.msg.style.display = 'none', 4000);
};

// --- 2. FLUJO DE AUTENTICACIÓN CON DOBLE FACTOR (2FA) ---
const login2faForm = $('login2faForm');
const login2faErrorMsg = $('login2faErrorMsg');

// Maneja el primer paso del Login (Validación en Firebase y solicitud del código 2FA)
form.login.onsubmit = async e => {
    e.preventDefault();
    form.err.style.display = 'none';
    form.btn.disabled = true;
    form.btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    const [mail, pass] = [form.mail.value.trim(), form.pass.value.trim()];
    try {
        await setPersistence(auth, inMemoryPersistence);
        // Habilita el acceso directo exclusivo para propósitos de prueba / demostración
        if (mail === 'caseta@algeciras.es' && pass === '123456') {
            sessionStorage.setItem('casetaId', 'demo_caseta_001');
            return init();
        }
        const userCredential = await signInWithEmailAndPassword(auth, mail, pass);
        form.btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando código...';
        
        // Petición al endpoint seguro de Cloudflare Workers para el despacho del correo 2FA
        const idToken = await userCredential.user.getIdToken(true);
        const response = await fetch(`${WORKER_URL}/api/enviar-codigo-2fa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }
        });
        const resData = await response.json();
        if (!response.ok) throw new Error(resData.error || "Error al enviar el código de verificación.");
        
        // Transición visual hacia el panel de ingreso de 6 dígitos del 2FA
        form.login.classList.add('hidden');
        login2faForm.classList.remove('hidden');
        if (resData.emailSent === false) {
            login2faErrorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${resData.message}`;
            login2faErrorMsg.className = 'statusMsg error';
            login2faErrorMsg.style.display = 'block';
        } else {
            login2faErrorMsg.style.display = 'none';
        }
        $('twoFactorInput').value = '';
        $('twoFactorInput').focus();
    } catch (err) {
        await signOut(auth);
        form.err.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${err.message || "Credenciales incorrectas."}`;
        form.err.style.display = 'block';
    } finally {
        form.btn.disabled = false;
        form.btn.innerHTML = 'Iniciar Sesión';
    }
};

// Segundo paso del Login: Validación del PIN numérico de seguridad de 6 dígitos
login2faForm?.addEventListener('submit', async e => {
    e.preventDefault();
    login2faErrorMsg.style.display = 'none';
    const codeVal = $('twoFactorInput').value.trim();
    if (codeVal.length !== 6) {
        login2faErrorMsg.textContent = "El código debe tener exactamente 6 dígitos.";
        login2faErrorMsg.style.display = 'block';
        return;
    }
    const btn = e.target.querySelector('.submitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("La sesión ha expirado o es inválida. Por favor, vuelve a iniciar sesión.");
        
        // Valida el token 2FA llamando a la API de Cloudflare Workers
        const idToken = await user.getIdToken(true);
        const response = await fetch(`${WORKER_URL}/api/verificar-codigo-2fa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
            body: JSON.stringify({ codigo: codeVal })
        });
        const resData = await response.json();
        if (!response.ok) throw new Error(resData.error || "Código de verificación incorrecto.");
        
        // Recupera el identificador de caseta vinculado a la cuenta del propietario en la base de datos
        let casetaId = null;
        const userSnap = await getDoc(doc(db, "usuario", user.uid));
        if (userSnap.exists() && userSnap.data().casetaId) {
            casetaId = userSnap.data().casetaId;
        } else {
            let snap = await getDocs(query(collection(db, "feria"), where("ownerId", "==", user.uid)));
            if (snap.empty) snap = await getDocs(query(collection(db, "feria"), where("ownerId", "==", user.email)));
            if (!snap.empty) casetaId = snap.docs[0].id;
        }
        if (casetaId) {
            sessionStorage.setItem('casetaId', casetaId);
            login2faForm.classList.add('hidden');
            form.login.classList.remove('hidden');
            init();
        } else {
            throw new Error("No tienes ninguna caseta asignada a tu cuenta. Contacta con el administrador.");
        }
    } catch (err) {
        login2faErrorMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${err.message}`;
        login2faErrorMsg.style.display = 'block';
        // Auto-redirecciona al formulario si hay un problema crítico con el código expirado
        if (err.message.includes("expirado") || err.message.includes("máximo de intentos") || err.message.includes("sesión ha expirado")) {
            setTimeout(async () => {
                await signOut(auth);
                login2faForm.classList.add('hidden');
                form.login.classList.remove('hidden');
                form.err.style.display = 'none';
            }, 3000);
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Verificar Código';
    }
});

// Acción de volver al login inicial cancelando la sesión intermedia
$('backToLoginBtn')?.addEventListener('click', async () => {
    await signOut(auth);
    login2faForm.classList.add('hidden');
    form.login.classList.remove('hidden');
    form.err.style.display = 'none';
});

// Acción para reenviar el código 2FA
$('resend2faBtn')?.addEventListener('click', async () => {
    const resendBtn = $('resend2faBtn');
    const origText = resendBtn.textContent;
    resendBtn.style.pointerEvents = 'none';
    resendBtn.textContent = 'Enviando...';
    login2faErrorMsg.style.display = 'none';
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("No hay un usuario activo. Por favor, vuelve a iniciar sesión.");
        const idToken = await user.getIdToken(true);
        const response = await fetch(`${WORKER_URL}/api/enviar-codigo-2fa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` }
        });
        const resData = await response.json();
        if (!response.ok) throw new Error(resData.error || "Error al reenviar el código.");
        
        if (resData.emailSent === false) {
            login2faErrorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${resData.message}`;
            login2faErrorMsg.className = 'statusMsg error';
            login2faErrorMsg.style.display = 'block';
        } else {
            login2faErrorMsg.textContent = "Código reenviado con éxito.";
            login2faErrorMsg.className = 'statusMsg success';
            login2faErrorMsg.style.display = 'block';
            setTimeout(() => { login2faErrorMsg.style.display = 'none'; }, 3000);
        }
    } catch (err) {
        login2faErrorMsg.className = 'statusMsg error';
        login2faErrorMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${err.message}`;
        login2faErrorMsg.style.display = 'block';
    } finally {
        resendBtn.style.pointerEvents = 'auto';
        resendBtn.textContent = origText;
    }
});

// --- 3. CARGA DE DATOS Y GESTIÓN DE EVENTOS DIARIOS ---
let currentCasetaData = null;
let currentSchedule = {};
let isImageRemoved = false;
let activeEditDay = "Día 20";
const FERIA_DIAS = ["Día 20", "Día 21", "Día 22", "Día 23", "Día 24", "Día 25", "Día 26", "Día 27", "Día 28"];

/**
 * Dibuja las pestañas selectoras de día del planificador semanal.
 */
const renderDayTabs = () => {
    const tabsCont = $('modal-dia-tabs');
    if (!tabsCont) return;
    tabsCont.innerHTML = '';
    FERIA_DIAS.forEach(day => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `modal-dia-tab-btn${day === activeEditDay ? ' active' : ''}`;
        btn.textContent = day;
        btn.onclick = () => {
            activeEditDay = day;
            renderDayTabs();
            renderScheduleList();
        };
        tabsCont.appendChild(btn);
    });
};

/**
 * Renderiza la lista completa de eventos del día seleccionado para su edición.
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
                <span class="schedule-item-time">${item.hora}</span>
                <span class="schedule-item-activity">${item.actividad || item.descripcion || ''}</span>
            </div>
            <button type="button" class="delete-event-inline" data-index="${idx}" title="Eliminar evento">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');
    
    // Asigna el evento de remoción a cada botón de eliminación individual
    listContainer.querySelectorAll('.delete-event-inline').forEach(btn => {
        btn.onclick = () => {
            dayEvents.splice(parseInt(btn.dataset.index, 10), 1);
            renderScheduleList();
        };
    });
};

/**
 * Carga los datos desde Firestore y los mapea en los formularios correspondientes.
 * 
 * @param {string} id - Identificador único de la caseta a recuperar.
 */
const loadData = async id => {
    const inputs = [form.num, form.nom, form.desc, form.img, form.tags];
    currentSchedule = Object.fromEntries(FERIA_DIAS.map(d => [d, []]));
    activeEditDay = "Día 20";

    // Carga de datos de demostración en modo Sandbox
    if (id === 'demo_caseta_001') {
        [form.num.value, form.nom.value, form.desc.value, form.tags.value] = ['001 (Demo)', 'Caseta de Prueba', 'Descripción genérica', 'Tradicional, Familiar, Pública'];
        form.imgPrev.src = 'https://via.placeholder.com/300x200?text=Imagen+Demo';
        form.previewCont.style.display = form.removeImg.style.display = 'block';
        form.img.style.borderRadius = '10px 10px 0 0';
        isImageRemoved = false;
        inputs.forEach(i => i.classList.remove('skeleton'));
        $('tagsContainer')?.classList.remove('skeleton');
        syncTagBadges();
        currentSchedule["Día 20"] = [{ hora: '14:30', actividad: 'Comida de Socios' }];
        currentSchedule["Día 21"] = [{ hora: '18:00', actividad: 'Concierto de Flamenquito' }];
        currentSchedule["Día 27"] = [{ hora: '23:00', actividad: 'Sesión DJ Especial' }];
        currentSchedule["Día 28"] = [{ hora: '20:00', actividad: 'Cierre de Feria / Espectáculo Pirotécnico' }];
        renderDayTabs();
        renderScheduleList();
        return showMsg("Modo Demo Activo", true);
    }

    try {
        const snap = await getDoc(doc(db, "feria", id));
        if (snap.exists()) {
            const d = snap.data();
            currentCasetaData = d;
            form.num.value = snap.id;
            form.nom.value = d.nombre || '';
            form.desc.value = d.descripcion || '';
            form.tags.value = Array.isArray(d.etiquetas) ? d.etiquetas.join(', ') : (d.etiqueta || '');
            
            // Re-estructura la programación de eventos importados de la base de datos (normaliza formatos antiguos)
            const prog = d.programacion || d.eventos;
            if (prog && typeof prog === 'object' && !Array.isArray(prog)) {
                Object.keys(prog).forEach(day => {
                    let dayKey = day;
                    const numMatch = day.match(/\d+/);
                    if (numMatch) {
                        const dayNum = numMatch[0];
                        if (dayNum >= 20 && dayNum <= 28) dayKey = `Día ${dayNum}`;
                    }
                    if (Array.isArray(prog[day])) currentSchedule[dayKey] = [...prog[day]];
                });
            } else if (Array.isArray(prog)) {
                currentSchedule["Día 20"] = [...prog];
            }
            renderDayTabs();
            renderScheduleList();
            
            isImageRemoved = false;
            if (d.imagen) {
                form.imgPrev.src = d.imagen;
                form.previewCont.style.display = form.removeImg.style.display = 'block';
                form.img.style.borderRadius = '10px 10px 0 0';
            } else {
                form.imgPrev.src = '';
                form.previewCont.style.display = form.removeImg.style.display = 'none';
                form.img.style.borderRadius = '10px';
            }
        } else {
            throw new Error("Datos no encontrados");
        }
    } catch (e) {
        showMsg("Error de conexión", false);
    } finally {
        inputs.forEach(i => i.classList.remove('skeleton'));
        $('tagsContainer')?.classList.remove('skeleton');
        syncTagBadges();
    }
};

// --- 4. COMPRESIÓN LOCAL Y SUBIDA DE IMAGEN DE PORTADA ---
/**
 * Comprime las dimensiones y peso de la imagen utilizando canvas antes del envío.
 */
const compressAndGetBase64 = (file, maxWidth = 800, maxHeight = 600) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
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
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

// Verifica las proporciones de la imagen (bloquea portadas verticales en favor del diseño Premium)
form.img.onchange = e => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = evt => {
            const img = new Image();
            img.src = evt.target.result;
            img.onload = () => {
                if (img.height > img.width) {
                    showMsg("Las imágenes en formato vertical no están permitidas. Por favor, sube una imagen en formato horizontal (apaisada).", false);
                    form.img.value = '';
                    form.imgPrev.src = '';
                    form.previewCont.style.display = form.removeImg.style.display = 'none';
                    form.img.style.borderRadius = '10px';
                    isImageRemoved = true;
                    return;
                }
                form.imgPrev.src = evt.target.result;
                form.previewCont.style.display = form.removeImg.style.display = 'block';
                form.img.style.borderRadius = '10px 10px 0 0';
                isImageRemoved = false;
            };
        };
        reader.readAsDataURL(file);
    }
};

// Acción: Eliminar la portada actual de la caseta
form.removeImg.onclick = () => {
    form.img.value = '';
    form.imgPrev.src = '';
    form.previewCont.style.display = form.removeImg.style.display = 'none';
    form.img.style.borderRadius = '10px';
    isImageRemoved = true;
};

// --- 5. ACTUALIZACIÓN SEGUIDA DE DATOS A FIRESTORE ---
form.edit.onsubmit = async e => {
    e.preventDefault();
    const id = sessionStorage.getItem('casetaId');
    if (!id) return init();
    form.save.disabled = true;
    form.save.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    try {
        if (id === 'demo_caseta_001') return showMsg("Datos de demostración actualizados", true);
        const data = {
            nombre: form.nom.value.trim(),
            descripcion: form.desc.value.trim(),
            etiquetas: form.tags.value.split(',').map(s => s.trim()).filter(Boolean),
            programacion: currentSchedule,
            portada_url: deleteField() // Limpia registros antiguos legados
        };
        
        // Adjunta el Base64 comprimido si se cargó un archivo nuevo
        const file = form.img.files[0];
        if (file) {
            data.imagen = await compressAndGetBase64(file);
        } else if (isImageRemoved) {
            data.imagen = "";
        }
        
        // Conserva el estado de activación en el mapa y la asignación del propietario
        if (currentCasetaData) {
            if (currentCasetaData.ownerId !== undefined) data.ownerId = currentCasetaData.ownerId;
            if (currentCasetaData.estatus !== undefined) data.estatus = currentCasetaData.estatus;
        }
        await updateDoc(doc(db, "feria", id), data);
        showMsg("Datos actualizados correctamente", true);
    } catch (e) {
        showMsg("Error al guardar cambios: " + e.message, false);
    } finally {
        form.save.disabled = false;
        form.save.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
    }
};

// --- 6. CERRAR SESIÓN ---
$('logoutBtn').onclick = () => {
    signOut(auth);
    sessionStorage.removeItem('casetaId');
    init();
};

// --- 7. ARRANQUE E INICIALIZACIÓN ---
const init = async () => {
    try {
        // Precarga de la base de datos las etiquetas predefinidas aprobadas por el ayuntamiento
        const docSnap = await getDoc(doc(db, "feria", "etiquetas"));
        if (docSnap.exists() && Array.isArray(docSnap.data().predefinidas)) {
            PREDEFINED_TAGS = docSnap.data().predefinidas;
        }
    } catch (e) {
        console.error("Error al cargar etiquetas predefinidas de la BD:", e);
    }
    renderPredefinedTags();
    renderDayTabs();

    // Habilita la inserción rápida de actividades diarias
    const addBtn = $('addEventBtn');
    if (addBtn) {
        addBtn.onclick = () => {
            const horaInp = $('addEventHora');
            const actInp = $('addEventActividad');
            const [horaVal, actVal] = [horaInp.value.trim(), actInp.value.trim()];
            if (!horaVal || !actVal) return showMsg("Por favor, rellena tanto la hora como la actividad", false);
            if (!currentSchedule[activeEditDay]) currentSchedule[activeEditDay] = [];
            currentSchedule[activeEditDay].push({ hora: horaVal, actividad: actVal });
            renderScheduleList();
            horaInp.value = actInp.value = '';
        };
    }

    // Advierte al usuario si está ejecutando la app a través del protocolo file:/// (CORS blocks)
    if (window.location.protocol === 'file:') {
        const warn = $('corsWarningMsg');
        if (warn) warn.style.display = 'block';
    }

    // Valida si existe una sesión activa persistente de caseta en el navegador
    const id = sessionStorage.getItem('casetaId');
    if (id) {
        show('panel');
        loadData(id);
    } else {
        show('login');
        form.login.reset();
        if (form.err) form.err.style.display = 'none';
    }
};

// Limpia cualquier credencial antigua al cargar inicialmente
sessionStorage.removeItem('casetaId');
signOut(auth);
init();
