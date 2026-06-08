import { db } from './firebase-config.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

/**
 * Función global para inicializar la base de datos de Firebase con las 56 casetas,
 * las etiquetas predefinidas y la cuenta de usuario de prueba vinculada.
 * 
 * Para ejecutarla:
 * 1. Añade temporalmente al final de index.html:
 *    <script type="module" src="temp_admin_script.js"></script>
 * 2. Abre index.html en tu navegador.
 * 3. Abre la consola de desarrollador (F12) y ejecuta:
 *    await initializeDatabase();
 * 4. Elimina la etiqueta <script> de index.html una vez completado.
 */
window.initializeDatabase = async () => {
    console.log("🚀 Iniciando la creación de la base de datos en Firebase...");

    try {
        // 1. Crear documento de etiquetas predefinidas
        console.log("🏷️ Creando etiquetas predefinidas...");
        await setDoc(doc(db, "feria", "etiquetas"), {
            predefinidas: ["Pública", "Privada", "Tradicional", "Moderna", "Familiar", "Juvenil", "Comida", "Copas"]
        });
        console.log("✅ Etiquetas predefinidas creadas.");

        // 2. Crear las 56 casetas (p01 a p56)
        console.log("🎪 Creando 56 casetas...");
        for (let i = 1; i <= 56; i++) {
            const id = 'p' + i.toString().padStart(2, '0');
            const nombre = id === "p01" ? "EL PITO" : `Caseta ${i}`;
            
            await setDoc(doc(db, "feria", id), {
                numero: i.toString(),
                nombre: nombre,
                descripcion: "",
                imagen: "",
                estatus: true,
                etiquetas: [],
                programacion: {
                    "Día 20": [],
                    "Día 21": [],
                    "Día 22": [],
                    "Día 23": [],
                    "Día 24": [],
                    "Día 25": [],
                    "Día 26": [],
                    "Día 27": [],
                    "Día 28": []
                }
            });
            console.log(`  └─ Caseta ${id} creada (${nombre})`);
        }
        console.log("✅ 56 casetas creadas correctamente.");

        // 3. Crear el usuario administrador de prueba (UID asignado a caseta p01)
        console.log("👤 Creando usuario propietario...");
        await setDoc(doc(db, "usuario", "Xog28SLQYnROqv4DlKrZcPWZLz23"), {
            casetaId: "p01",
            email: "raulbarrios@gmail.com"
        });
        console.log("✅ Usuario raulbarrios@gmail.com (UID: Xog28SLQYnROqv4DlKrZcPWZLz23) vinculado a caseta p01.");

        console.log("🎉 ¡Proceso de inicialización completado con éxito!");
    } catch (error) {
        console.error("❌ Error durante la inicialización de la base de datos:", error);
    }
};
