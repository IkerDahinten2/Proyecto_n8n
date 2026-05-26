document.getElementById('inasistencia-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const form = event.target;
    const submitButton = form.querySelector('.btn-submit');
    const webhookUrl = 'http://localhost:5678/webhook-test/justificacion-inasistencia';

    // Bloquear el botón para evitar envíos duplicados mientras procesa n8n
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    // ==========================================
    // NUEVA VALIDACIÓN: Control de tamaño (Máximo 5MB)
    // ==========================================
    const fileInput = form.querySelector('#adjunto');
    if (fileInput.files.length > 0) {
        const fileSize = fileInput.files[0].size; // Tamaño en bytes
        const maxBytes = 5 * 1024 * 1024; // 5 Megabytes

        if (fileSize > maxBytes) {
            alert('El archivo supera el límite permitido de 5MB. Por favor, reduzca el tamaño del documento antes de enviarlo.');
            
            // Restauramos el botón para que puedan intentar de nuevo con otro archivo
            submitButton.disabled = false;
            submitButton.textContent = 'Enviar formulario';
            return; // Detiene la ejecución por completo y no envía nada a n8n
        }
    }
    // ==========================================

    // Creamos un FormData vacío para estructurar los nombres exactos que espera n8n
    const payload = new FormData();

    // Mapeo exacto de los campos de texto para el Prompt de Gemini en n8n
    payload.append('Nombre completo', form.nombre.value);
    payload.append('Motivo de inasistencia', form.motivo.value);
    payload.append('Descripción del motivo', form.descripcion.value);
    
    // Otros datos de control para la base de datos de Google Sheets
    payload.append('estudiante_id', form.estudiante_id.value);
    payload.append('telegram_id', form.telegram_id.value);
    payload.append('correo', form.correo.value);
    payload.append('fecha', form.fecha.value);

    // Adjuntar el archivo binario manteniendo el nombre exacto 'adjunto'
    if (fileInput.files.length > 0) {
        payload.append('adjunto', fileInput.files[0]);
    }

    try {
        // Ejecución de la petición HTTP POST hacia el webhook de n8n
        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: payload 
            // Nota: No se define 'Content-Type' manualmente; el navegador lo hace de forma automática
        });

        // Validación de Error HTTP (Respuestas 4xx o 5xx desde n8n)
        if (!response.ok) {
            throw new Error(`Error HTTP de n8n. Estado: ${response.status} - ${response.statusText}`);
        }

        // Procesamiento del éxito
        alert('Formulario enviado correctamente. Su justificación está en revisión.');
        form.reset();

    } catch (error) {
        // Depuración avanzada: Captura fallos de red, CORS o rechazos del servidor n8n
        console.error('--- DEPURACIÓN FORMULARIO N8N ---');
        console.error('Mensaje de error:', error.message);
        console.error('Stack Trace:', error.stack);
        
        alert(`No se pudo enviar la solicitud. Error para depuración: ${error.message}`);
    } finally {
        // Restaurar el estado del botón sin importar si hubo éxito o fallo
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar formulario';
    }
});