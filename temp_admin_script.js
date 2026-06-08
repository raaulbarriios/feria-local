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
        const nombresCasetas = {
            1: "EL PITO",
            2: "C.MUNICIPAL",
            3: "LAS QUEMÁS",
            4: "LA GÜENA",
            5: "EL REQUIEBRO",
            6: "LA CHICUELINA",
            7: "LOS ESPECIALES",
            8: "33 Y UN QUINQUE",
            9: "LOS ESTRELLAOS",
            10: "LOS CAMBORIOS",
            11: "LA FARANDULINA",
            12: "EL ESTRIBO",
            13: "C.D.ALGECIRAS FEMENINO SALA",
            14: "CINCUENTA Y CINCO",
            15: "MAERSK",
            16: "PEÑA VETERANOS",
            17: "TODOS LOS JUEVES",
            18: "EL CHATO Y LA BELLA",
            19: "NOVIA DEL SOL",
            20: "LA NUESTRA",
            21: "LOS PALMEROS",
            22: "LOS BUYITAS",
            23: "LA TERTULIA",
            24: "LOZ DER PUEBLO",
            25: "LA VENENCIA",
            26: "EL ANCLOTE",
            27: "LOS CURIALES",
            28: "LOS JULIANES",
            29: "F.A.S. PORTUARIOS",
            30: "LA PALOMA ESPECIAL",
            31: "EL CABALLO CLUB DEPORTIVO",
            32: "EL TETRAPODO",
            33: "EL MERO",
            34: "PEÑA MIGUELÍN",
            35: "LA PROVIDENCIA",
            36: "POROMPOMPERO",
            37: "EL RELEVO",
            38: "LA CODORNIZ",
            39: "CAYETANA",
            40: "LA FAVORITA",
            41: "NO NI NÁ",
            42: "LA CALLE ESPECIAL",
            43: "EL CALLEJÓN",
            44: "LA HANGARILLA",
            45: "ACTIVA Y AMIGOS",
            46: "LA PUREZA",
            47: "LA CUARENTA Y SIETE",
            48: "LA PUÑETERA",
            49: "RINCÓN LATINO",
            50: "LA BODEGUILLA",
            51: "LIMBAZO",
            52: "ALMACEN",
            53: "SUSPIROS 5",
            54: "SOLERA DEL REAL",
            55: "ALM.MONTADOR MODULOS",
            56: "DE LUCÍA"
        };

        for (let i = 1; i <= 56; i++) {
            const id = 'p' + i.toString().padStart(2, '0');
            const nombre = nombresCasetas[i] || `Caseta ${i}`;
            
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
            }, { merge: true });
            console.log(`  └─ Caseta ${id} configurada (${nombre})`);
        }
        console.log("✅ 56 casetas configuradas correctamente.");

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
