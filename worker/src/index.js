export default {
  async fetch(request, env, ctx) {
    // Determinar origen permitido de forma segura (soporta desarrollo local, previsualizaciones de Pages y producción)
    const origin = request.headers.get("Origin");
    let allowedOrigin = "https://proyecto-ayuntamiento-mapa.pages.dev"; // Valor por defecto seguro

    const allowedOrigins = [
      "https://proyecto-ayuntamiento-mapa.pages.dev",
      "https://eventos-ayuntamiento.firebaseapp.com",
      "https://eventos-ayuntamiento.web.app"
    ];

    if (origin) {
      const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
      const isPagesDev = origin.endsWith(".pages.dev") && (origin.includes("proyecto-ayuntamiento") || origin.includes("eventos-ayuntamiento"));
      
      if (isLocalhost || isPagesDev || allowedOrigins.includes(origin)) {
        allowedOrigin = origin;
      }
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const url = new URL(request.url);
    const validPaths = ["/api/actualizar-cuenta", "/api/enviar-codigo-2fa", "/api/verificar-codigo-2fa"];
    if (!validPaths.includes(url.pathname)) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    try {
      // 1. Validar Cabecera Authorization
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      const idToken = authHeader.split(" ")[1];
      const projectId = env.FIREBASE_PROJECT_ID;

      // 2. Verificar el Firebase ID Token
      let decodedToken;
      try {
        decodedToken = await verifyFirebaseIdToken(idToken, projectId);
      } catch (err) {
        return new Response(JSON.stringify({ error: `Unauthorized: Token verification failed: ${err.message}` }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // 3. Validar Rol de Administrador por UID (solo para actualizar-cuenta)
      const ADMIN_UID = "z8yDFCw3a8YQFnCCns7FOPKnDBp2";
      if (url.pathname === "/api/actualizar-cuenta") {
        if (decodedToken.sub !== ADMIN_UID && decodedToken.user_id !== ADMIN_UID) {
          return new Response(JSON.stringify({ error: "Forbidden: Only the system administrator is allowed to perform this action" }), {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 4. Leer y validar cuerpo de la petición
        const { email, password, uid } = await request.json();

        // 5. Parsear Cuenta de Servicio (Service Account)
        let serviceAccount;
        try {
          serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
        } catch (err) {
          return new Response(JSON.stringify({ error: "Worker misconfiguration: FIREBASE_SERVICE_ACCOUNT is not a valid JSON string" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 6. Obtener Token de Acceso OAuth 2.0 de Google
        const scope = "https://www.googleapis.com/auth/identitytoolkit";
        const oauthToken = await getGoogleAuthToken(serviceAccount, scope);

        // CASO ESPECIAL: Si se proporciona uid y NO email, es una búsqueda de correo por UID
        if (uid && !email) {
          const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${oauthToken}`
            },
            body: JSON.stringify({
              localId: [uid]
            })
          });

          const lookupData = await lookupRes.json();
          if (lookupRes.ok && lookupData.users && lookupData.users.length > 0) {
            const userEmail = lookupData.users[0].email;
            return new Response(JSON.stringify({ success: true, email: userEmail }), {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          } else {
            return new Response(JSON.stringify({ error: "User not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }
        }

        // De lo contrario, procedemos con el flujo normal de registro/actualización de cuenta
        if (!email) {
          return new Response(JSON.stringify({ error: "Missing email in request body" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        if (password && password.length < 6) {
          return new Response(JSON.stringify({ error: "Password must be at least 6 characters long" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 7. Buscar si el usuario ya existe en Firebase Authentication
        const lookupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${oauthToken}`
          },
          body: JSON.stringify({
            email: [email]
          })
        });

        const lookupData = await lookupRes.json();
        let userUid = null;

        if (lookupRes.ok && lookupData.users && lookupData.users.length > 0) {
          userUid = lookupData.users[0].localId;
        }

        // Bloquear cualquier intento de modificar la cuenta del administrador supremo mediante el Worker.
        if (userUid === ADMIN_UID) {
          return new Response(JSON.stringify({ error: "Forbidden: La cuenta del administrador del sistema no se puede modificar desde el panel. Debe cambiarse de forma manual en la consola de Firebase por seguridad." }), {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        let resultMsg = "";
        if (userUid) {
          if (password) {
            // El usuario ya existe -> Actualizar Contraseña
            const updateRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${oauthToken}`
              },
              body: JSON.stringify({
                localId: userUid,
                password: password
              })
            });

            const updateData = await updateRes.json();
            if (!updateRes.ok) {
              throw new Error(updateData.error?.message || "Failed to update user password");
            }
            resultMsg = "Password updated successfully";
          } else {
            resultMsg = "User UID retrieved successfully";
          }
        } else {
          // El usuario no existe. Si no se especificó contraseña, devolver error indicando que se requiere contraseña para crearlo.
          if (!password) {
            return new Response(JSON.stringify({ error: "El usuario no existe en Firebase Authentication. Para registrar la cuenta por primera vez, debe ingresar una contraseña." }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }

          // El usuario no existe -> Registrar usuario nuevo
          const signupRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${oauthToken}`
            },
            body: JSON.stringify({
              email: email,
              password: password
            })
          });

          const signupData = await signupRes.json();
          if (!signupRes.ok) {
            throw new Error(signupData.error?.message || "Failed to create new user");
          }
          userUid = signupData.localId;
          resultMsg = "User created successfully";
        }

        return new Response(JSON.stringify({ success: true, message: resultMsg, uid: userUid }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } else if (url.pathname === "/api/enviar-codigo-2fa") {
        const uid = decodedToken.user_id || decodedToken.sub;
        const email = decodedToken.email;

        if (!email) {
          return new Response(JSON.stringify({ error: "Email not found in token" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 1. Generar código de 6 dígitos
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 horas

        // 2. Parsear Cuenta de Servicio (Service Account)
        let serviceAccount;
        try {
          serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
        } catch (err) {
          return new Response(JSON.stringify({ error: "Worker misconfiguration: FIREBASE_SERVICE_ACCOUNT is not a valid JSON string" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // Scope para Firestore
        const scope = "https://www.googleapis.com/auth/datastore";
        const oauthToken = await getGoogleAuthToken(serviceAccount, scope);

        // 3. Escribir código en Firestore (REST API PATCH)
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/codigos_2fa/${uid}`;
        const firestoreRes = await fetch(firestoreUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${oauthToken}`
          },
          body: JSON.stringify({
            fields: {
              codigo: { stringValue: code },
              expira: { timestampValue: expirationTime },
              intentos: { integerValue: "0" }
            }
          })
        });

        if (!firestoreRes.ok) {
          const fsError = await firestoreRes.text();
          throw new Error(`Failed to save 2FA code in Firestore: ${fsError}`);
        }

        // 4. Enviar email usando Resend
        if (!env.RESEND_API_KEY) {
          return new Response(JSON.stringify({ error: "Worker misconfiguration: RESEND_API_KEY is not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const fromEmail = env.RESEND_FROM_EMAIL || "Feria Algeciras <onboarding@resend.dev>";
        let emailSent = true;
        let emailWarning = null;

        try {
          const resendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${env.RESEND_API_KEY}`
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [email],
              subject: "Código de Verificación 2FA - Feria de Algeciras",
              html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); background-color: #ffffff;">
                  <div style="text-align: center; margin-bottom: 25px;">
                    <h2 style="color: #1e3a8a; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Feria de Algeciras</h2>
                    <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Portal de Caseteros</p>
                  </div>
                  <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 25px;">
                  <p style="font-size: 15px; color: #334155; line-height: 1.6; margin-top: 0;">Hola,</p>
                  <p style="font-size: 15px; color: #334155; line-height: 1.6;">Has solicitado acceder al Panel de Control de tu caseta. Para verificar tu identidad, introduce el siguiente código de 6 dígitos en la pantalla de acceso:</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <span style="display: inline-block; background-color: #f1f5f9; color: #1e3a8a; font-size: 32px; font-weight: 800; letter-spacing: 6px; padding: 12px 30px; border-radius: 10px; border: 1px solid #cbd5e1; font-family: monospace;">${code}</span>
                  </div>
                  <p style="font-size: 13px; color: #e11d48; font-weight: 500; text-align: center; margin: 0;">Este código es de un solo uso y expirará en 24 horas.</p>
                  <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0 20px 0;">
                  <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.5;">Si no has solicitado este acceso, puedes ignorar este correo de forma segura o ponerte en contacto con el administrador del sistema.</p>
                </div>
              `
            })
          });

          const resendData = await resendRes.json();
          if (!resendRes.ok) {
            emailSent = false;
            emailWarning = resendData.message || JSON.stringify(resendData);
            console.warn(`Resend failed (sandbox limit or unverified domain): ${emailWarning}`);
          }
        } catch (err) {
          emailSent = false;
          emailWarning = err.message;
          console.warn(`Resend fetch error: ${emailWarning}`);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: emailSent 
            ? "Código de verificación enviado con éxito." 
            : `El código 2FA se guardó en la Base de Datos, pero Resend Sandbox bloqueó el envío de correo (${emailWarning}). Puedes ver tu código temporal en Firestore (colección 'codigos_2fa') para completar la prueba.`,
          emailSent: emailSent,
          warning: emailWarning
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } else if (url.pathname === "/api/verificar-codigo-2fa") {
        const uid = decodedToken.user_id || decodedToken.sub;
        const { codigo } = await request.json();

        if (!codigo) {
          return new Response(JSON.stringify({ error: "Missing verification code in request body" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 1. Parsear Cuenta de Servicio
        let serviceAccount;
        try {
          serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
        } catch (err) {
          return new Response(JSON.stringify({ error: "Worker misconfiguration: FIREBASE_SERVICE_ACCOUNT is not a valid JSON string" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const scope = "https://www.googleapis.com/auth/datastore";
        const oauthToken = await getGoogleAuthToken(serviceAccount, scope);

        // 2. Obtener el código de Firestore
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/codigos_2fa/${uid}`;
        const firestoreRes = await fetch(firestoreUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${oauthToken}`
          }
        });

        if (firestoreRes.status === 404) {
          return new Response(JSON.stringify({ error: "El código no existe o ya ha expirado. Por favor, solicita uno nuevo." }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        if (!firestoreRes.ok) {
          const fsError = await firestoreRes.text();
          throw new Error(`Failed to fetch 2FA code from Firestore: ${fsError}`);
        }

        const fsData = await firestoreRes.json();
        const storedCode = fsData.fields.codigo.stringValue;
        const expiraStr = fsData.fields.expira.timestampValue;
        const intentos = parseInt(fsData.fields.intentos.integerValue || "0", 10);

        // 3. Validar Expiración
        const expiraTime = new Date(expiraStr).getTime();
        const now = Date.now();

        if (now > expiraTime) {
          // Eliminar el código expirado
          await fetch(firestoreUrl, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${oauthToken}`
            }
          });
          return new Response(JSON.stringify({ error: "El código de verificación ha expirado. Solicita uno nuevo." }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 4. Validar Intentos Máximos
        if (intentos >= 3) {
          // Eliminar el código bloqueado
          await fetch(firestoreUrl, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${oauthToken}`
            }
          });
          return new Response(JSON.stringify({ error: "Has superado el número máximo de intentos. Solicita un nuevo código." }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 5. Comparar Códigos
        if (codigo === storedCode) {
          // Código correcto -> Limpiar y retornar éxito
          await fetch(firestoreUrl, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${oauthToken}`
            }
          });
          return new Response(JSON.stringify({ success: true, message: "Código verificado correctamente" }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        } else {
          // Código incorrecto -> Incrementar intentos
          const nuevosIntentos = intentos + 1;
          const intentosRestantes = 3 - nuevosIntentos;

          if (intentosRestantes <= 0) {
            // Eliminar porque ya consumió el último intento
            await fetch(firestoreUrl, {
              method: "DELETE",
              headers: {
                "Authorization": `Bearer ${oauthToken}`
              }
            });
            return new Response(JSON.stringify({ error: "Has superado el número máximo de intentos. Solicita un nuevo código." }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }

          // Actualizar en Firestore
          await fetch(`${firestoreUrl}?updateMask.fieldPaths=intentos`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${oauthToken}`
            },
            body: JSON.stringify({
              fields: {
                intentos: { integerValue: nuevosIntentos.toString() }
              }
            })
          });

          return new Response(JSON.stringify({ 
            error: `Código incorrecto. Te quedan ${intentosRestantes} intento(s) restante(s).`,
            intentosRestantes: intentosRestantes 
          }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      }

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};

// --- AYUDANTE 1: GENERADOR DE GOOGLE OAUTH2 ACCESS TOKEN PARA SERVICE ACCOUNTS ---
async function getGoogleAuthToken(serviceAccount, scope) {
  const pem = serviceAccount.private_key;
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem.substring(
    pem.indexOf(pemHeader) + pemHeader.length,
    pem.indexOf(pemFooter)
  ).replace(/\s/g, "");
  
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const now = Math.floor(Date.now() / 1000);
  const claimSet = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const unsignedJwt = `${header}.${claimSet}`;
  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(unsignedJwt)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedJwt}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Failed to fetch OAuth token");
  }
  return data.access_token;
}

// --- AYUDANTE 2: VALIDADOR CRIPTOGRÁFICO DE ID TOKENS DE FIREBASE ---
async function verifyFirebaseIdToken(token, projectId) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  const header = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));

  // Validaciones del Token JWT estándar de Google
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error("Token expired");
  if (payload.iat > now) throw new Error("Token issued in the future");
  if (payload.aud !== projectId) throw new Error("Invalid audience");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("Invalid issuer");

  // Obtener claves públicas (JWK) de Google en tiempo real
  const jwkRes = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  const jwkData = await jwkRes.json();
  const jwk = jwkData.keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error("Public key not found for kid");

  // Importar clave pública JWK usando Web Crypto API
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["verify"]
  );

  // Decodificar la firma criptográfica
  const signatureString = atob(parts[2].replace(/-/g, "+").replace(/_/g, "/"));
  const signatureBytes = new Uint8Array(signatureString.length);
  for (let i = 0; i < signatureString.length; i++) {
    signatureBytes[i] = signatureString.charCodeAt(i);
  }

  const unsignedToken = `${parts[0]}.${parts[1]}`;
  const encoder = new TextEncoder();
  const isValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signatureBytes,
    encoder.encode(unsignedToken)
  );

  if (!isValid) throw new Error("Invalid signature");
  return payload;
}
