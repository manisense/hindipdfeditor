// PP-OCRv5 (Devanagari) text detection + recognition on onnxruntime-web, the runtime the editor
// would ship. Pure JS pre- and post-processing, no OpenCV: detected regions are axis-aligned,
// which suits scans that are roughly straight. All image sizes and coordinates are in pixels of
// the input image.
import { readFileSync } from "node:fs";

/** An RGB image: `data` holds width × height × 3 bytes, row by row. */
/** @typedef {{ width: number, height: number, data: Uint8Array }} RgbImage */

/** Reads a binary PPM (P6, as written by `pdftoppm`) into an RGB image. */
export function readPpm(file) {
  const bytes = readFileSync(file);
  const fields = [];
  let i = 0;
  while (fields.length < 4) {
    while (/\s/.test(String.fromCharCode(bytes[i]))) i += 1;
    if (bytes[i] === 0x23) {
      while (bytes[i] !== 0x0a) i += 1;
      continue;
    }
    let token = "";
    while (!/\s/.test(String.fromCharCode(bytes[i])))
      token += String.fromCharCode(bytes[i++]);
    fields.push(token);
  }
  const [magic, width, height, max] = fields;
  if (magic !== "P6" || max !== "255")
    throw new Error(`${file}: not an 8-bit P6 PPM`);
  const data = bytes.subarray(
    i + 1,
    i + 1 + Number(width) * Number(height) * 3,
  );
  return {
    width: Number(width),
    height: Number(height),
    data: new Uint8Array(data),
  };
}

/**
 * Bilinear sample of `image` region (x, y, w, h) into a CHW float tensor of size outW × outH,
 * channels in BGR order (Paddle's training order), each value mapped by `norm(value, channel)`.
 */
function resizeToChw(image, region, outW, outH, norm) {
  const out = new Float32Array(3 * outW * outH);
  const plane = outW * outH;
  const sx = region.w / outW;
  const sy = region.h / outH;
  for (let oy = 0; oy < outH; oy++) {
    const fy = Math.min(
      Math.max(region.y + (oy + 0.5) * sy - 0.5, 0),
      image.height - 1,
    );
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, image.height - 1);
    const wy = fy - y0;
    for (let ox = 0; ox < outW; ox++) {
      const fx = Math.min(
        Math.max(region.x + (ox + 0.5) * sx - 0.5, 0),
        image.width - 1,
      );
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, image.width - 1);
      const wx = fx - x0;
      for (let c = 0; c < 3; c++) {
        const rgb = 2 - c; // BGR output from RGB input
        const p = (yy, xx) => image.data[(yy * image.width + xx) * 3 + rgb];
        const v =
          (p(y0, x0) * (1 - wx) + p(y0, x1) * wx) * (1 - wy) +
          (p(y1, x0) * (1 - wx) + p(y1, x1) * wx) * wy;
        out[c * plane + oy * outW + ox] = norm(v, c);
      }
    }
  }
  return out;
}

const DET_MEAN = [0.485, 0.456, 0.406];
const DET_STD = [0.229, 0.224, 0.225];

/**
 * Size the detector sees: Paddle's `limit_type: min` (only upscales so the short side is at least
 * `minSide`) capped at `maxSide`, rounded to multiples of 32.
 */
export function detInputSize(width, height, minSide = 64, maxSide = 4000) {
  let ratio =
    Math.min(width, height) < minSide ? minSide / Math.min(width, height) : 1;
  if (Math.max(width, height) * ratio > maxSide)
    ratio = maxSide / Math.max(width, height);
  const round32 = (v) => Math.max(32, Math.round(v / 32) * 32);
  return { w: round32(width * ratio), h: round32(height * ratio) };
}

/**
 * How far detected lines are grown before recognition. Paddle's default is 1.5, but the
 * recognizer emits one character slot per 8 px of a 48 px tall crop, and a dense Hindi line has
 * more code points than that once a padded crop is scaled down; letters then drop out. 0.6 kept
 * 136 of 144 words on the sample scan (1.5 kept 64). Tuned on one page: re-check on a wider set.
 */
export const UNCLIP_RATIO = 0.6;

/**
 * DB post-processing on a probability map (mapW × mapH): pixels above `thresh` form 4-connected
 * regions; a region is kept when its pixels' mean probability is at least `boxThresh`; its box is
 * grown by `area × unclipRatio / perimeter` on every side (Paddle's unclip, for a rectangle).
 *
 * @returns Boxes in probability-map pixels: { x, y, w, h, score }.
 */
export function dbBoxes(
  prob,
  mapW,
  mapH,
  {
    thresh = 0.3,
    boxThresh = 0.6,
    unclipRatio = UNCLIP_RATIO,
    minSize = 3,
  } = {},
) {
  const label = new Int32Array(mapW * mapH);
  const boxes = [];
  const stack = [];
  let next = 0;
  for (let start = 0; start < prob.length; start++) {
    if (label[start] || prob[start] <= thresh) continue;
    next += 1;
    label[start] = next;
    stack.push(start);
    let x0 = mapW,
      y0 = mapH,
      x1 = -1,
      y1 = -1;
    let sum = 0;
    let count = 0;
    while (stack.length) {
      const idx = stack.pop();
      sum += prob[idx];
      count += 1;
      const x = idx % mapW;
      const y = (idx - x) / mapW;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const neighbours = [
        x > 0 ? idx - 1 : -1,
        x < mapW - 1 ? idx + 1 : -1,
        y > 0 ? idx - mapW : -1,
        y < mapH - 1 ? idx + mapW : -1,
      ];
      for (const n of neighbours) {
        if (n >= 0 && !label[n] && prob[n] > thresh) {
          label[n] = next;
          stack.push(n);
        }
      }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    if (Math.min(w, h) < minSize) continue;
    // Mean over the region's own pixels (Paddle scores the text polygon, not its bounding box).
    const score = sum / count;
    if (score < boxThresh) continue;
    const grow = (w * h * unclipRatio) / (2 * (w + h));
    const gx0 = Math.max(0, x0 - grow);
    const gy0 = Math.max(0, y0 - grow);
    const gx1 = Math.min(mapW, x1 + 1 + grow);
    const gy1 = Math.min(mapH, y1 + 1 + grow);
    if (Math.min(gx1 - gx0, gy1 - gy0) < minSize + 2) continue;
    boxes.push({ x: gx0, y: gy0, w: gx1 - gx0, h: gy1 - gy0, score });
  }
  return boxes;
}

/**
 * Greedy CTC decoding of a [steps × classes] score matrix: best class per step, repeats merged,
 * class 0 (blank) dropped; class i maps to `characters[i - 1]`.
 */
export function ctcDecode(scores, steps, classes, characters) {
  let text = "";
  let previous = -1;
  for (let t = 0; t < steps; t++) {
    let best = 0;
    for (let c = 1; c < classes; c++)
      if (scores[t * classes + c] > scores[t * classes + best]) best = c;
    if (best !== 0 && best !== previous) text += characters[best - 1] ?? "";
    previous = best;
  }
  return text;
}

/** The recognizer's character list from its `inference.yml`, plus Paddle's trailing space. */
export function readCharacterDict(ymlFile) {
  const lines = readFileSync(ymlFile, "utf8").split("\n");
  const start = lines.findIndex((line) => line.trim() === "character_dict:");
  const characters = [];
  for (const line of lines.slice(start + 1)) {
    const match = /^\s*- (.*)$/.exec(line);
    if (!match) break;
    let value = match[1];
    if (value.startsWith("'") && value.endsWith("'"))
      value = value.slice(1, -1).replace(/''/g, "'");
    else if (value.startsWith('"') && value.endsWith('"'))
      value = JSON.parse(value);
    characters.push(value);
  }
  characters.push(" ");
  return characters;
}

/**
 * Loads the detector and recognizer. `ort` is the onnxruntime-web module.
 *
 * @returns `recognizePage(image)` → lines in reading order, each { text, box } in image pixels.
 */
export async function createPaddleOcr(
  ort,
  { detModel, recModel, recYml, detOptions = {} },
) {
  const det = await ort.InferenceSession.create(readFileSync(detModel));
  const rec = await ort.InferenceSession.create(readFileSync(recModel));
  const characters = readCharacterDict(recYml);

  async function detect(image) {
    const size = detInputSize(image.width, image.height);
    // Paddle applies mean/std by array channel to its BGR image, so channel c takes DET_MEAN[c].
    const input = resizeToChw(
      image,
      { x: 0, y: 0, w: image.width, h: image.height },
      size.w,
      size.h,
      (v, c) => (v / 255 - DET_MEAN[c]) / DET_STD[c],
    );
    const output = await det.run({
      [det.inputNames[0]]: new ort.Tensor("float32", input, [
        1,
        3,
        size.h,
        size.w,
      ]),
    });
    const prob = output[det.outputNames[0]].data;
    const fx = image.width / size.w;
    const fy = image.height / size.h;
    return dbBoxes(prob, size.w, size.h, detOptions).map((b) => ({
      x: b.x * fx,
      y: b.y * fy,
      w: b.w * fx,
      h: b.h * fy,
    }));
  }

  async function recognize(image, box) {
    const height = 48;
    const width = Math.max(16, Math.ceil((height * box.w) / box.h));
    const input = resizeToChw(
      image,
      box,
      width,
      height,
      (v) => (v / 255 - 0.5) / 0.5,
    );
    const output = await rec.run({
      [rec.inputNames[0]]: new ort.Tensor("float32", input, [
        1,
        3,
        height,
        width,
      ]),
    });
    const tensor = output[rec.outputNames[0]];
    const [, steps, classes] = tensor.dims;
    if (classes !== characters.length + 1)
      throw new Error(
        `recognizer has ${classes} classes, dictionary ${characters.length + 1}`,
      );
    return ctcDecode(tensor.data, steps, classes, characters).trim();
  }

  return async function recognizePage(image) {
    const boxes = await detect(image);
    boxes.sort((a, b) =>
      Math.abs(a.y - b.y) < Math.min(a.h, b.h) / 2 ? a.x - b.x : a.y - b.y,
    );
    const lines = [];
    for (const box of boxes)
      lines.push({ text: await recognize(image, box), box });
    return lines;
  };
}
