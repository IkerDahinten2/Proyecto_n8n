---

## 💻 Componentes e Ingeniería de Nodos (n8n)

### 1. Módulo de Ingesta y Webhook de Entrada (`Webhook1`)
* **Nodo:** `n8n-nodes-base.webhook`
* **Método HTTP:** `POST`
* **Ruta (Path):** `justificacion-inasistencia`
* **Justificación de Diseño:** Recibe la carga útil (*payload*) del formulario web en formato JSON (datos del alumno, motivo y descripción). Se configuró de manera dedicada para aislar el punto de entrada de la lógica de procesamiento, permitiendo un acoplamiento débil con la interfaz de usuario.

### 2. Capa de Inteligencia Artificial (`Basic LLM Chain1` & `Google Gemini Chat Model1`)
* **Nodos:** `@n8n/n8n-nodes-langchain.chainLlm` + `lmChatGoogleGemini`
* **Estrategia de Prompting:** El sistema inyecta las variables del cuerpo del formulario (`Nombre completo`, `Motivo de inasistencia`, `Descripción del motivo`) bajo restricciones explícitas de estructuración.
* **Comportamiento Esperado:** Fuerza al modelo a actuar como un validador determinista que solo puede responder un JSON estricto con las llaves `veredicto` (Aprobado, Rechazado o Dudoso), `nivel_confianza` (numérico entero de 0 a 100), y `razon`. 

### 3. Procesamiento de Datos y Sanitización (`Code in JavaScript1`)
* **Nodo:** `n8n-nodes-base.code` (Modo: `runOnceForEachItem`)
* **Justificación de Diseño:** Los LLM pueden llegar a incluir texto no deseado o envolturas de formato Markdown (` ```json `). Este nodo actúa como un *middleware* crítico de sanitización de datos antes de impactar las bases de datos.
* **Funcionalidad del Código:**
  * Detecta si la entrada ya es un objeto nativo.
  * Utiliza Expresiones Regulares (`replace`) para remover bloques de código markdown y limpia espacios vacíos (`trim()`).
  * Implementa un bloque `try-catch` de dos capas: el primero intenta parsear el JSON completo; si falla debido a texto decorativo adyacente insertado por el LLM, calcula los índices de apertura `{` y cierre `}` mediante `indexOf` y `lastIndexOf` para extraer el JSON puro y forzar su rescate de forma segura.
  * Si todo falla, intercepta la excepción devolviendo un objeto por defecto seguro (`veredicto: "Dudoso"`, `nivel_confianza: 0`) para evitar que el flujo caiga en un error fatal de ejecución (*crash*).

### 4. Capa Logística de Ruteo y Clasificación (`Switch`)
* **Nodo:** `n8n-nodes-base.switch`
* **Justificación de Funcionamiento:** Evalúa dinámicamente la variable `{{ $json.nivel_confianza }}` obtenida tras la sanitización.
  * **Regla 1 (Umbral Seguro):** Si el nivel de confianza es mayor o igual a **80** (`>= 80`), el sistema considera que el dictamen automático es de alta fidelidad, derivándolo hacia la automatización inmediata.
  * **Regla 2 (Umbral de Ambigüedad):** Si la confianza es menor a **80**, el sistema lo cataloga de forma segura como caso "Dudoso" o "Revisión Manual", derivándolo al canal de supervisión de personal humano calificado para evitar falsos positivos/negativos.

### 5. Persistencia y Almacenamiento Distribuido (`Google Sheets`)
* **Nodos:** `Append row in sheet`, `Append row in sheet1`, `Append row in sheet2`
* **Justificación de Diseño:** Dependiendo del resultado arrojado por el enrutador (`Switch`), los datos se insertan en pestañas o matrices independientes del libro contable en Google Sheets. Esto actúa como un lago de datos estructurado que segmenta los estados históricos, garantizando que el personal administrativo solo tenga que interactuar manualmente con la hoja de "Pendientes de Revisión".

### 6. Sistema Corporativo de Notificaciones en Tiempo Real (`Telegram Nodes`)
* **Nodos:** `Send a text message`, `Send a text message1`, `Send a text message2`
* **Justificación de Diseño:** Comunica de inmediato al estudiante el resultado analítico de su solicitud (o el acuse de recibo si entró a revisión manual). Esto cierra el ciclo asíncrono, reduciendo drásticamente la carga de correos o llamadas de seguimiento al departamento escolar.

---

## 🤖 Arquitectura del Bot de Consulta Síncrona

El sistema cuenta con un hilo de ejecución independiente diseñado para que el estudiante autogestione sus dudas sobre el estatus de su solicitud:

1. **`Telegram Trigger`:** Escucha activamente los mensajes de texto enviados por los alumnos al Bot.
2. **`Switch1`:** Realiza un análisis de texto básico. Si el comando contiene cadenas de saludo o texto plano no formateado, deriva a guías de asistencia. Si contiene un identificador numérico, lo canaliza al siguiente paso.
3. **`Get row(s) in sheet`:** Ejecuta una consulta indexada de lectura a Google Sheets buscando la coincidencia exacta del ID del estudiante.
4. **`If`:** Comprueba si la consulta trajo registros.
   * **Rama Verdadera (True):** Extrae la información actual (`Aprobado`, `Rechazado` o `Pendiente`) y envía de vuelta un mensaje formateado al alumno con el veredicto y la razón del estado.
   * **Rama Falsa (False):** Si el ID no existe en la persistencia, se le envía un mensaje informando que no hay registros asociados para evitar la incertidumbre.

---

## 🛡️ Análisis de Riesgos, Mitigaciones y Validaciones

| Riesgo Técnico Detectado | Impacto en Producción | Mecanismo de Mitigación Implementado |
| :--- | :--- | :--- |
| **Alucinación o malas respuestas del LLM** | Alto (Veredictos erróneos) | Umbral estricto en el nodo `Switch`. Cualquier confianza menor a 80 es aislada y enviada a revisión humana obligatoria. |
| **Fallas de formato de respuesta (Texto plano)** | Crítico (Bindeo roto / Quiebre de flujo) | Bloques `try-catch` con rescate por índices de subcadenas (`{}`) en el nodo nativo JavaScript. |
| **Dependencias de terceros (Google Sheets / Telegram API)** | Medio (Pérdida temporal de servicio) | Desacoplamiento de flujos y almacenamiento asíncrono nativo en n8n que permite reintentar las ejecuciones pausadas desde los logs. |

---

## 🚀 Instrucciones de Instalación e Importación

1. Asegúrate de tener una instancia funcional de **n8n** (Cloud o Auto-alojada vía Docker).
2. Clona este repositorio o descarga el archivo `Proyecto_n8n.json`.
3. Desde tu panel de control de n8n, crea un nuevo flujo (*Workflow*).
4. Haz clic en las opciones del menú superior derecho y selecciona **Import from File...** (Importar desde archivo).
5. Selecciona el archivo `Proyecto_n8n.json` provisto.
6. Configura tus credenciales empresariales para los siguientes conectores externos:
   * **Google Sheets API:** Vincula tu cuenta institucional y apunta el Spreadsheet ID al documento de control de asistencias.
   * **Telegram Bot API:** Genera tu Token de acceso con `@BotFather` y agrégalo en los nodos emisores y receptores.
   * **Google Gemini API:** Provee una clave de API válida de Google AI Studio con cuotas suficientes de tokens.
7. Cambia el estado del flujo de **Inactive** a **Active** para desplegar el sistema en producción.