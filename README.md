# Manual de Usuario Extendido - Panel de Administración de la Feria de Algeciras

Bienvenido al Panel de Administración Oficial de la Feria de Algeciras. Este documento es una guía paso a paso, exhaustiva y detallada, orientada al personal administrativo encargado de la gestión integral de la información de las casetas.

El panel permite realizar altas de usuarios (caseteros), gestionar permisos de visibilidad pública en el mapa, y modificar en tiempo real la información descriptiva y de agenda de cualquier caseta.

---

## 1. Acceso Seguro al Sistema (Login y 2FA)

El sistema cuenta con un acceso protegido para garantizar que solo personal autorizado pueda modificar la base de datos de la feria.

### Pasos para iniciar sesión:
1. **Abrir el portal:** Ingresa a la dirección web privada del panel de administración.
2. **Introducir credenciales:** En la pantalla principal ("Admin Login"), escribe tu **Correo Electrónico Institucional** y tu **Contraseña** secreta.
3. **Botón de acceso:** Haz clic en el botón azul **"ACCEDER AL PANEL"**. En este momento, el botón mostrará el mensaje *"VERIFICANDO..."*.
4. **Validación de Doble Factor (2FA):** 
   - Si las credenciales son correctas, el sistema te redirigirá a una segunda pantalla de seguridad.
   - Revisa la bandeja de entrada del correo que acabas de introducir. Habrás recibido un email oficial con el asunto "Código de Verificación 2FA - Feria de Algeciras".
   - Este correo contiene un código único de 6 dígitos. Escríbelo en la casilla de verificación.
   - *Nota:* El código tiene una caducidad de 24 horas y solo dispone de 3 intentos antes de bloquearse.
5. **Entrada:** Una vez verificado el código, accederás automáticamente al "Dashboard" o Panel Principal.

---

## 2. Descripción del Panel Principal (Dashboard)

El panel de trabajo está diseñado para ser intuitivo y evitar que se mezclen las tareas. Está compuesto por una barra superior institucional con el botón de salida y un bloque central con tres pestañas navegables: **Credenciales**, **Editar** y **Etiquetas**.

> ⚠️ **REGLA DE ORO:** Siempre que termines de trabajar en el panel, debes hacer clic en el botón rojo **"SALIR"** de la esquina superior derecha. Esto desconectará tu sesión y evitará que cualquier otra persona con acceso al ordenador pueda manipular el sistema.

---

## 3. Pestaña 1: Credenciales (Gestión de Accesos y Caseteros)

Esta es la sección más crítica. Aquí controlarás la identidad de las casetas, si aparecen o no en el mapa público, y a quién pertenece cada una.

### ¿Cómo buscar o registrar una caseta?
1. **Nº de Caseta:** Es el campo principal. Debes introducir el identificador exacto, por ejemplo, `54` o `p54`. 
   - *Magia del sistema:* Nada más escribir el número, el panel buscará en la base de datos. Si la caseta ya existe, los campos inferiores (Nombre y Correo) se rellenarán solos. Si está vacía, significa que es un registro nuevo.
2. **Nombre de la Caseta:** Escribe el nombre completo y oficial, asegurándote de no cometer errores tipográficos.
3. **Correo del Propietario:** Introduce el email de la persona responsable de la caseta. A este correo se le vinculará el acceso a su propio panel privado (el Portal del Casetero).
4. **Contraseña:** 
   - *Caseta nueva:* Escribe una contraseña segura (mínimo 6 caracteres). Luego, deberás proporcionarle esta contraseña al casetero.
   - *Modificar caseta existente:* Si solo estás cambiando el nombre o habilitando la caseta, deja este campo **vacío**. Si el dueño ha olvidado su clave y te pide una nueva, escríbela aquí para sobreescribirla.

### Mostrar/Ocultar del mapa (Habilitar y Deshabilitar)
*   Botón Verde **HABILITAR:** Activa la caseta. Esto significa que aparecerá dibujada y coloreada en el Mapa Interactivo Público que usan los ciudadanos.
*   Botón Rojo **DESHABILITAR:** Oculta la caseta temporal o permanentemente. Útil si la caseta tiene problemas, no se monta este año o hay errores en sus datos.

### Guardar Cambios de Credenciales
*   Botón Azul **ACTUALIZAR:** Una vez hayas revisado el nombre, el correo y la contraseña, debes hacer clic aquí obligatoriamente. Verás un cartel verde abajo que dirá "Actualizado" confirmando que el dueño ya tiene acceso.

---

## 4. Pestaña 2: Editar (Diseño de la Ficha Pública)

Esta pestaña te permite actuar como "diseñador" de la ficha que todos los visitantes verán en la app web de la feria al pulsar sobre una caseta en el mapa. 

*Requisito: Antes de usar esta pestaña, debes haber buscado un Número de Caseta válido en la pestaña anterior (Credenciales).*

### 4.1 Selección de Etiquetas (Tags)
Las etiquetas sirven para que los ciudadanos sepan qué ambiente tiene la caseta de un solo vistazo.
- Verás un listado de "píldoras" con palabras (ej: Pública, Tradicional, Copas, Comida).
- Haz clic sobre las que correspondan a esta caseta. Cambiarán a un color azul oscuro cuando estén seleccionadas.

### 4.2 Subir Imagen de Portada
Esta imagen es la carta de presentación de la caseta.
1. Haz clic sobre la franja donde pone **"Imagen de la Caseta"** (acompañada del icono de una foto).
2. Se abrirá el explorador de archivos de tu ordenador o móvil. Elige la foto.
3. **Restricción de Formato:** El sistema es inteligente. Si intentas subir una foto hecha en vertical (más alta que ancha), mostrará un mensaje de error rojo y la rechazará. **Solo se admiten fotos horizontales (apaisadas)** para que el diseño del mapa cuadre perfectamente.
4. Si te equivocas de foto, pulsa el botón rojo **"ELIMINAR"** que aparecerá debajo de la miniatura para quitarla.

### 4.3 Descripción del Ambiente
El cuadro de texto inferior es libre. Puedes escribir los precios de las bebidas, si hay menú especial, la historia de la peña, etc.

### 4.4 Programación Oficial (Día a Día)
Si la caseta tiene conciertos, actuaciones infantiles o comidas populares, aquí es donde se organizan:
1. Verás unos botones correspondientes a los días de la feria: **Día 20, Día 21, ..., Día 28**. Haz clic en el día exacto donde va a ocurrir el evento.
2. En la caja que dice **"Hora"**, escribe en formato militar o normal (ej: `14:00` o `17:30`).
3. En la caja **"Actividad"**, escribe de qué trata (ej: `Concierto de Flamenquito`).
4. Pulsa el botón verde **"Añadir Evento"**.
5. El evento aparecerá en la lista de arriba. Si te equivocas, pulsa el botón rojo de la **papelera** a su derecha para borrarlo al instante.

### Guardar la Ficha
*   Botón Azul **GUARDAR INFORMACIÓN:** Es imperativo hacer clic aquí antes de irte. Si cambias de pestaña o cierras el navegador sin guardarlo, todo el trabajo de fotos y eventos se perderá.

---

## 5. Pestaña 3: Etiquetas (El Diccionario de la Feria)

Esta herramienta es muy poderosa porque modifica el catálogo global. Afecta a TODAS las casetas y a las opciones que ven los propios caseteros en sus paneles privados.

### Eliminar Etiquetas Obsoletas
- En el bloque superior verás el listado de todas las etiquetas activas. Si, por ejemplo, decides que la etiqueta "Discoteca" ya no tiene sentido, pulsa la "X" roja a su derecha. Desaparecerá de las opciones para todo el mundo.

### Crear Nuevas Etiquetas
- Si este año se inaugura una nueva temática, ve a la caja inferior donde dice "Nombre de la nueva etiqueta".
- Escribe, por ejemplo, "Concurso de Tapas".
- Pulsa el botón verde **"Añadir Etiqueta"**. Verás cómo sube automáticamente a la lista superior.

### Confirmar Cambios del Diccionario
*   Botón Azul **GUARDAR ETIQUETAS:** ¡El paso más olvidado! Tras añadir o borrar palabras, debes hacer clic obligatoriamente en este botón final para que los cambios se guarden en el "cerebro" (la base de datos) del sistema.

---

## 6. Solución a Problemas Comunes

1. **"Acceso Denegado" al iniciar sesión:** Asegúrate de estar usando un correo designado como administrador. Si eres un casetero normal, debes usar el portal de caseteros, no este panel.
2. **"Las imágenes en formato vertical no están permitidas":** Recorta la foto en tu ordenador o móvil para que sea horizontal, o haz una foto nueva apaisada.
3. **No me llega el código 2FA:** Revisa tu carpeta de *Spam* o *Correo no deseado*. El código caduca en 24 horas, si expira, simplemente vuelve a intentar iniciar sesión para forzar el envío de un correo nuevo.
4. **He cambiado los días de programación pero no salen:** Es posible que no hayas hecho clic en el botón azul gigante de "GUARDAR INFORMACIÓN" situado debajo de la sección de eventos. Todo cambio requiere confirmación manual.
