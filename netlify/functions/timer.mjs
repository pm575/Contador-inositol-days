import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import sharp from "sharp";
import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;

/*
|--------------------------------------------------------------------------
| CONFIGURACIÓN GENERAL
|--------------------------------------------------------------------------
*/

const WIDTH = 600;
const HEIGHT = 202;

/*
  Fecha objetivo:
  19 de julio de 2026 a las 11:59:59 p. m.
  Zona horaria de Ciudad de México: UTC-6
*/
const TARGET_ISO = "2026-07-19T23:59:59-06:00";

/*
  60 frames, uno por segundo.
*/
const FRAME_COUNT = 60;
const FRAME_DELAY_MS = 1000;

/*
|--------------------------------------------------------------------------
| COLORES
|--------------------------------------------------------------------------
*/

const COLORS = {
  backgroundStart: "#EEE7FA",
  backgroundEnd: "#FDFCF8",
  border: "#FF5AA7",
  number: "#A30A70",
  label: "#430048"
};

/*
|--------------------------------------------------------------------------
| FUENTES
|--------------------------------------------------------------------------
*/

let fontsPromise;

function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFont("montserrat-latin-800-normal.woff"),
      readFont("montserrat-latin-900-normal.woff")
    ]).then(([bold, black]) => [
      {
        name: "Montserrat",
        data: bold,
        weight: 800,
        style: "normal"
      },
      {
        name: "Montserrat",
        data: black,
        weight: 900,
        style: "normal"
      }
    ]);
  }

  return fontsPromise;
}

function readFont(filename) {
  const here = path.dirname(fileURLToPath(import.meta.url));

  const candidates = [
    path.join(
      here,
      "../../node_modules/@fontsource/montserrat/files",
      filename
    ),
    path.join(
      process.cwd(),
      "node_modules/@fontsource/montserrat/files",
      filename
    ),
    path.join(
      "/var/task/node_modules/@fontsource/montserrat/files",
      filename
    )
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate);
    }
  }

  throw new Error(`No se encontró la fuente ${filename}`);
}

/*
|--------------------------------------------------------------------------
| CÁLCULO DEL TIEMPO
|--------------------------------------------------------------------------
*/

function calculateParts(nowMs) {
  const targetMs = Date.parse(TARGET_ISO);
  const remainingMs = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(remainingMs / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
    expired: remainingMs <= 0
  };
}

/*
|--------------------------------------------------------------------------
| DISEÑO GENERAL
|--------------------------------------------------------------------------
*/

function baseStyle() {
  return {
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: COLORS.backgroundStart,
    backgroundImage: `linear-gradient(180deg, ${COLORS.backgroundStart} 0%, ${COLORS.backgroundEnd} 100%)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  };
}

/*
|--------------------------------------------------------------------------
| COLUMNAS DEL TEMPORIZADOR
|--------------------------------------------------------------------------
*/

function box(value, label) {
  return {
    type: "div",
    props: {
      style: {
        width: 109,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      },
      children: [
        {
          type: "div",
          props: {
            style: {
              fontFamily: "Montserrat",
              fontWeight: 900,
              fontSize: 52,
              lineHeight: 0.88,
              letterSpacing: -2,
              color: COLORS.number
            },
            children: value
          }
        },
        {
          type: "div",
          props: {
            style: {
              marginTop: 15,
              fontFamily: "Montserrat",
              fontWeight: 800,
              fontSize: label === "SEGUNDOS" ? 13 : 15,
              lineHeight: 1,
              letterSpacing: -0.25,
              color: COLORS.label
            },
            children: label
          }
        }
      ]
    }
  };
}

/*
|--------------------------------------------------------------------------
| ÁRBOL VISUAL PARA SATORI
|--------------------------------------------------------------------------
*/

function timerTree(parts, frameIndex = 0) {
  /*
    Mensaje que aparecerá cuando termine la promoción.
  */
  if (parts.expired) {
    return {
      type: "div",
      props: {
        style: baseStyle(),
        children: {
          type: "div",
          props: {
            style: {
              width: 562,
              height: 163,
              border: `2px solid ${COLORS.border}`,
              borderRadius: 19,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Montserrat",
              fontWeight: 900,
              fontSize: 38,
              color: COLORS.number
            },
            children: "PROMOCIÓN FINALIZADA"
          }
        }
      }
    };
  }

  /*
    El punto separador cambia ligeramente de opacidad para aportar
    movimiento visual adicional.
  */
  const separatorOpacity = frameIndex % 2 === 0 ? 1 : 0.58;

  const separator = {
    type: "div",
    props: {
      style: {
        width: 28,
        marginTop: -32,
        textAlign: "center",
        fontFamily: "Montserrat",
        fontWeight: 900,
        fontSize: 40,
        color: COLORS.number,
        opacity: separatorOpacity
      },
      children: "·"
    }
  };

  return {
    type: "div",
    props: {
      style: baseStyle(),
      children: {
        type: "div",
        props: {
          style: {
            width: 562,
            height: 163,
            border: `2px solid ${COLORS.border}`,
            borderRadius: 19,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          },
          children: [
            box(parts.days, "DÍAS"),
            separator,
            box(parts.hours, "HORAS"),
            separator,
            box(parts.minutes, "MINUTOS"),
            separator,
            box(parts.seconds, "SEGUNDOS")
          ]
        }
      }
    }
  };
}

/*
|--------------------------------------------------------------------------
| RENDERIZADO DE CADA FRAME
|--------------------------------------------------------------------------
*/

async function renderRgba(nowMs, frameIndex, fonts) {
  const parts = calculateParts(nowMs);

  const svg = await satori(timerTree(parts, frameIndex), {
    width: WIDTH,
    height: HEIGHT,
    fonts
  });

  return sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer();
}

/*
|--------------------------------------------------------------------------
| GENERACIÓN DEL GIF
|--------------------------------------------------------------------------
*/

async function makeGif(nowMs) {
  const fonts = await loadFonts();
  const gif = GIFEncoder();

  for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex += 1) {
    /*
      Cada frame representa un segundo posterior.
    */
    const frameTime = nowMs + frameIndex * FRAME_DELAY_MS;

    const rgba = await renderRgba(
      frameTime,
      frameIndex,
      fonts
    );

    /*
      Se utilizan los 256 colores permitidos por el formato GIF.
      Esto reduce el banding o franjas visibles del degradado.
    */
    const palette = quantize(rgba, 256);
    const indexedPixels = applyPalette(rgba, palette);

    gif.writeFrame(
      indexedPixels,
      WIDTH,
      HEIGHT,
      {
        palette,
        delay: FRAME_DELAY_MS,

        /*
          -1 evita que el GIF vuelva al primer frame.
          Al terminar, permanece en el último.
        */
        repeat: frameIndex === 0 ? -1 : undefined
      }
    );
  }

  gif.finish();

  return Buffer.from(gif.bytes());
}

/*
|--------------------------------------------------------------------------
| GENERACIÓN DEL PNG
|--------------------------------------------------------------------------
*/

async function makePng(nowMs) {
  const fonts = await loadFonts();
  const parts = calculateParts(nowMs);

  const svg = await satori(timerTree(parts, 0), {
    width: WIDTH,
    height: HEIGHT,
    fonts
  });

  return sharp(Buffer.from(svg))
    .png({
      compressionLevel: 9
    })
    .toBuffer();
}

/*
|--------------------------------------------------------------------------
| NETLIFY FUNCTION
|--------------------------------------------------------------------------
*/

export default async function handler(request) {
  try {
    const url = new URL(request.url);

    const requestedFormat = (
      url.searchParams.get("format") || "gif"
    ).toLowerCase();

    const format =
      requestedFormat === "png"
        ? "png"
        : "gif";

    const nowMs = Date.now();

    const body =
      format === "png"
        ? await makePng(nowMs)
        : await makeGif(nowMs);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type":
          format === "png"
            ? "image/png"
            : "image/gif",

        "Cache-Control":
          "private, no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate",

        "Pragma": "no-cache",
        "Expires": "0",

        "Content-Disposition":
          `inline; filename=vitatu-countdown.${format}`,

        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error(
      "Error al generar el temporizador:",
      error
    );

    return new Response(
      "No fue posible generar el temporizador.",
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      }
    );
  }
}
