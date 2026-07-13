import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import sharp from "sharp";
import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;

const WIDTH = 900;
const HEIGHT = 302;
const TARGET_ISO = "2026-07-19T23:59:59-06:00";
const FRAME_COUNT = 60;
const FRAME_DELAY_MS = 1000;

const COLORS = {
  background: "#EEE7FA",
  border: "#FF5AA7",
  number: "#A30A70",
  label: "#430048"
};

let fontsPromise;

function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFont("montserrat-latin-800-normal.woff"),
      readFont("montserrat-latin-900-normal.woff")
    ]).then(([bold, black]) => [
      { name: "Montserrat", data: bold, weight: 800, style: "normal" },
      { name: "Montserrat", data: black, weight: 900, style: "normal" }
    ]);
  }
  return fontsPromise;
}

function readFont(filename) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "../../node_modules/@fontsource/montserrat/files", filename),
    path.join(process.cwd(), "node_modules/@fontsource/montserrat/files", filename),
    path.join("/var/task/node_modules/@fontsource/montserrat/files", filename)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate);
  }

  throw new Error(`No se encontró la fuente ${filename}`);
}

function calculateParts(nowMs) {
  const targetMs = Date.parse(TARGET_ISO);
  const remaining = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(remaining / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
    expired: remaining <= 0
  };
}

function box(value, label) {
  return {
    type: "div",
    props: {
      style: {
        width: 164,
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
              fontSize: 78,
              lineHeight: 0.88,
              letterSpacing: -3,
              color: COLORS.number
            },
            children: value
          }
        },
        {
          type: "div",
          props: {
            style: {
              marginTop: 23,
              fontFamily: "Montserrat",
              fontWeight: 800,
              fontSize: label === "SEGUNDOS" ? 20 : 23,
              lineHeight: 1,
              letterSpacing: -0.4,
              color: COLORS.label
            },
            children: label
          }
        }
      ]
    }
  };
}

function timerTree(parts, frameIndex = 0) {
  if (parts.expired) {
    return {
      type: "div",
      props: {
        style: baseStyle(),
        children: {
          type: "div",
          props: {
            style: {
              width: 842,
              height: 244,
              border: `2px solid ${COLORS.border}`,
              borderRadius: 29,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Montserrat",
              fontWeight: 900,
              fontSize: 58,
              color: COLORS.number
            },
            children: "PROMOCIÓN FINALIZADA"
          }
        }
      }
    };
  }

  const separatorOpacity = frameIndex % 2 === 0 ? 1 : 0.58;
  const separator = {
    type: "div",
    props: {
      style: {
        width: 42,
        marginTop: -48,
        textAlign: "center",
        fontFamily: "Montserrat",
        fontWeight: 900,
        fontSize: 60,
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
            width: 842,
            height: 244,
            border: `2px solid ${COLORS.border}`,
            borderRadius: 29,
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

function baseStyle() {
  return {
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: COLORS.background,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  };
}

async function renderRgba(nowMs, frameIndex, fonts) {
  const parts = calculateParts(nowMs);
  const svg = await satori(timerTree(parts, frameIndex), {
    width: WIDTH,
    height: HEIGHT,
    fonts
  });

  return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
}

async function makeGif(nowMs) {
  const fonts = await loadFonts();
  const gif = GIFEncoder();

  for (let i = 0; i < FRAME_COUNT; i += 1) {
    const frameTime = nowMs + i * FRAME_DELAY_MS;
    const rgba = await renderRgba(frameTime, i, fonts);
    const palette = quantize(rgba, 64);
    const index = applyPalette(rgba, palette);

    gif.writeFrame(index, WIDTH, HEIGHT, {
      palette,
      delay: FRAME_DELAY_MS,
      repeat: i === 0 ? -1 : undefined
    });
  }

  gif.finish();
  return Buffer.from(gif.bytes());
}

async function makePng(nowMs) {
  const fonts = await loadFonts();
  const parts = calculateParts(nowMs);
  const svg = await satori(timerTree(parts, 0), {
    width: WIDTH,
    height: HEIGHT,
    fonts
  });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

export default async (request) => {
  try {
    const url = new URL(request.url);
    const requestedFormat = (url.searchParams.get("format") || "gif").toLowerCase();
    const format = requestedFormat === "png" ? "png" : "gif";
    const nowMs = Date.now();
    const body = format === "png" ? await makePng(nowMs) : await makeGif(nowMs);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": format === "png" ? "image/png" : "image/gif",
        "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Content-Disposition": `inline; filename=vitatu-countdown.${format}`,
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error(error);
    return new Response("No fue posible generar el temporizador.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
};
