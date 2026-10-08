# Instalar el servidor (10 minutos, una sola vez)

El servidor es gratuito y funciona con tu cuenta de Google. Guarda en una hoja de cálculo las preguntas que se suben desde la app y los resultados de todas las rondas. Tu hija no necesita ninguna cuenta ni contraseña.

## 1. Crear la hoja y el script

1. Entra en [sheets.new](https://sheets.new) y ponle de nombre **Repaso – datos**.
2. Menú **Extensiones → Apps Script**.
3. Borra lo que haya en `Código.gs` y pega todo el contenido de **`Codigo.gs`** (está en esta misma carpeta).
4. Pulsa el icono de guardar.

## 2. Publicarlo como aplicación web

1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. En el engranaje de «Seleccionar tipo», elige **Aplicación web**.
3. Rellena:
   - **Ejecutar como:** Yo
   - **Quién tiene acceso:** Cualquier usuario
4. Pulsa **Implementar** y autoriza el acceso con tu cuenta de Google. Si aparece «Google no ha verificado esta aplicación», pulsa **Configuración avanzada → Ir a … (no seguro)**. Es tu propio script.
5. Copia la **URL de la aplicación web**. Termina en `/exec`.

## 3. Conectarlo con la app

1. En GitHub, abre `index.html` y pulsa el lápiz para editarlo.
2. Busca esta línea:
   ```js
   const CONFIG={servidor:'',repo:'',rama:'main',carpeta:'preguntas'};
   ```
3. Pega la URL entre las primeras comillas:
   ```js
   const CONFIG={servidor:'https://script.google.com/macros/s/XXXX/exec',repo:'',rama:'main',carpeta:'preguntas'};
   ```
4. Pulsa **Commit changes**. En un minuto la app ya sube preguntas.

## Bueno saber

- **Nada se borra.** «Quitar» y «Guardar cambios» solo cambian la columna *estado* de la hoja *Subidas*. Para recuperar algo, cambia su estado a `activa`.
- **Sin contraseña significa que cualquiera con el enlace puede subir preguntas.** Para un quiz familiar el riesgo es bajo. Si algún día aparece algo raro, se quita desde la app o desde la hoja.
- **Si cambias `Codigo.gs`:** usa **Implementar → Gestionar implementaciones → editar → Nueva versión**. Así la URL no cambia.
- **Los resultados** de todos los dispositivos (iPhone, iPad, ordenador) se juntan en la hoja *Resultados*, y la página *Progreso* los muestra todos.
