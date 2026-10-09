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

1. En GitHub, abre `config.js` y pulsa el lápiz para editarlo.
2. Pega la URL entre las comillas de `servidor`:
   ```js
   servidor:'https://script.google.com/macros/s/XXXX/exec',
   ```
3. Pulsa **Commit changes**. En un minuto la app ya guarda preguntas.

## Bueno saber

- **Nada se borra.** «Quitar» y «Guardar cambios» solo cambian la columna *estado* de la hoja *Subidas*. Para recuperar algo, cambia su estado a `activa`.
- **Sin contraseña significa que cualquiera con el enlace puede subir preguntas.** Para un quiz familiar el riesgo es bajo. Si algún día aparece algo raro, se quita desde la app o desde la hoja.
- **Si cambias `Codigo.gs`:** usa **Implementar → Gestionar implementaciones → editar → Nueva versión**. Así la URL no cambia.
- **Los resultados** de todos los dispositivos (iPhone, iPad, ordenador) se juntan en la hoja *Resultados*, y la página *Progreso* los muestra todos.

## Logros y premios

- **PIN de los padres:** al principio de `Codigo.gs` está `var PIN_PADRES = '1234';`. Cámbialo por el tuyo antes de publicar la nueva versión. Solo con ese PIN se puede confirmar o rechazar un premio pedido.
- **Hoja «Premios»:** se crea sola la primera vez que se abre la app, ya con la lista inicial. Puedes cambiar el nombre o los puntos, añadir filas nuevas (con un `id` cualquiera, sin repetir) o poner `no` en la columna `activo` para ocultar un premio.
- **Hoja «Canjes»:** cada premio pedido. `pendiente` → lo confirmas tú en la app (Logros → Premios → Confirmar) y pasa a `entregado` o `rechazado` (si se rechaza, los puntos vuelven).
- Las medallas, la racha y los puntos se calculan en la app a partir de las rondas y de las preguntas subidas: no hay que tocar nada.
- **Empezar de cero:** en la app, Preguntas → Más opciones → «Empezar de cero los puntos» (pide el PIN). Se guarda en la hoja «Ajustes» la fecha desde la que cuentan los puntos; no se borra nada y se puede deshacer desde el mismo sitio.
- **Lista de premios nueva:** si la hoja «Premios» sigue exactamente con la primera lista, se cambia sola por la nueva. Si ya la habías tocado, no se cambia (bórrala entera y se vuelve a crear con la nueva).
- **Carga rápida:** la app solo descarga las preguntas y rondas nuevas desde la última vez; lo demás lo guarda en el dispositivo.
