# Temporizador dinámico Vitatú para Klaviyo

Proyecto listo para desplegar en Netlify. Genera un GIF o PNG dinámico sin marca de agua con cuenta regresiva al **19 de julio de 2026 a las 23:59:59, horario UTC-6**.

## Despliegue rápido

1. Crea un repositorio nuevo en GitHub y sube esta carpeta.
2. En Netlify selecciona **Add new site > Import an existing project**.
3. Conecta el repositorio.
4. Netlify detectará `netlify.toml`; no necesitas comando de compilación.
5. Publica el sitio.

## URLs

GIF dinámico:

```text
https://TU-SITIO.netlify.app/.netlify/functions/timer?format=gif
```

PNG dinámico:

```text
https://TU-SITIO.netlify.app/.netlify/functions/timer?format=png
```

## Bloque para Klaviyo

Pega esto en un bloque HTML y reemplaza `TU-SITIO`:

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center">
      <img
        src="https://TU-SITIO.netlify.app/.netlify/functions/timer?format=gif&amp;profile={{ person.id|default:'preview' }}&amp;campaign=julio-2026"
        alt="La promoción termina el 19 de julio de 2026"
        width="600"
        style="display:block;width:100%;max-width:600px;height:auto;border:0;margin:0 auto;"
      >
    </td>
  </tr>
</table>
```

## Configuración

La fecha está en `netlify/functions/timer.mjs`:

```js
const TARGET_ISO = "2026-07-19T23:59:59-06:00";
```

La función usa Montserrat mediante la dependencia `@fontsource/montserrat`; no es necesario subir archivos de fuente manualmente.

## Nota sobre correos

Los clientes de correo pueden almacenar imágenes en caché. El parámetro personalizado por perfil ayuda a reducirlo, pero no puede eliminarlo por completo. Outlook antiguo puede mostrar únicamente el primer fotograma del GIF. El primer fotograma siempre contiene el tiempo correcto al momento de solicitar la imagen.
