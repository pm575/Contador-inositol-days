import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import sharp from "sharp";
import gifenc from "gifenc";

const { GIFEncoder, quantize, applyPalette } = gifenc;

const WIDTH = 1110;
const HEIGHT = 372;
const TARGET_ISO = "2026-07-19T23:59:59-06:00";
const FRAME_COUNT = 12;
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
  const totalMinutes = Math.floor(remaining / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    expired: remaining <= 0
  };
}

function box(value, label) {
  return {
    type: "div",
    props: {
      style: {
        width: 275,
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
              fontSize: 120,
              lineHeight: 0.85,
              letterSpacing: -5,
              color: COLORS.number
            },
            children: value
          }
        },
        {
          type: "div",
          props: {
            style: {
              marginTop: 30,
              fontFamily: "Montserrat",
              fontWeight: 800,
              fontSize: 40,
              lineHeight: 1,
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
              width: 1040,
              height: 300,
              border: `2px solid ${COLORS.border}`,
              borderRadius: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Montserrat",
              fontWeight: 900,
              fontSize: 74,
              color: COLORS.number
            },
            children: "PROMOCIÓN FINALIZADA"
          }
        }
      }
    };
  }

  const separatorOpacity = frameIndex % 2 === 0 ? 1 : 0.55;
  const separator = {
    type: "div",
    props: {
      style: {
        width: 70,
        marginTop: -70,
        textAlign: "center",
        fontFamily: "Montserrat",
        fontWeight: 900,
        fontSize: 86,
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
            width: 1040,
            height: 300,
            border: `2px solid ${COLORS.border}`,
            borderRadius: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          },
          children: [
            box(parts.days, "DÍAS"),
            separator,
            box(parts.hours, "HORAS"),
            separator,
            box(parts.minutes, "MINUTOS")
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
    const rgba = await renderRgba(nowMs + i * FRAME_DELAY_MS, i, fonts);
    const palette = quantize(rgba, 128);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, WIDTH, HEIGHT, {
      palette,
      delay: FRAME_DELAY_MS,
      repeat: i === 0 ? 0 : undefined
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
    const format = (url.searchParams.get("format") || "gif").toLowerCase();
    const nowMs = Date.now();
    const body = format === "png" ? await makePng(nowMs) : await makeGif(nowMs);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": format === "png" ? "image/png" : "image/gif",
        "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Content-Disposition": `inline; filename=vitatu-countdown.${format === "png" ? "png" : "gif"}`,
        "Access-Control-Allow-Origin": "*"
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
