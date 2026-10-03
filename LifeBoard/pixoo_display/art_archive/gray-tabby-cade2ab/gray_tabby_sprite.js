// Archived from cade2ab. Rendering helpers come from that revision of pixoo_lifeboard.js.
const NIGHT_CAT_COLORS = {
  fur: [166, 177, 189],
  outline: [64, 76, 91],
  stripe: [82, 98, 116],
  eyes: [8, 12, 18],
  light: [218, 224, 230],
  pink: [226, 139, 154]
};

function drawWalkingCat(frame, x, y, phase, goingRight) {
  const sprite = createFrame(COLORS.black);
  const fur = NIGHT_CAT_COLORS.fur;
  drawNightCatTail(sprite, [[21, 8], [23, 6], [24, 4], [24, 2], [23, 1]], fur);
  const stride = Number(phase || 0) % 2;
  [10 + stride, 17 - stride].forEach((leg) => {
    drawRect(sprite, leg - 1, 12, 4, 4, NIGHT_CAT_COLORS.outline);
    drawRect(sprite, leg, 12, 2, 3, fur);
    drawRect(sprite, leg, 15, 3, 1, NIGHT_CAT_COLORS.light);
  });
  drawNightCatEllipse(sprite, 14, 10, 7, 3);
  [12, 16, 19].forEach((stripe) => drawLine(sprite, stripe, 8, stripe + 1, 10, NIGHT_CAT_COLORS.stripe));
  drawNightCatFace(sprite, 6);
  drawNightCatEars(sprite, 2, 10);
  drawLine(sprite, 4, 3, 5, 4, NIGHT_CAT_COLORS.stripe);
  drawLine(sprite, 8, 3, 7, 4, NIGHT_CAT_COLORS.stripe);
  setPixel(sprite, 6, 3, NIGHT_CAT_COLORS.stripe);
  drawRect(sprite, 5, 9, 3, 2, NIGHT_CAT_COLORS.light);
  drawRect(sprite, 3, 6, 2, 2, NIGHT_CAT_COLORS.eyes);
  drawRect(sprite, 8, 6, 2, 2, NIGHT_CAT_COLORS.eyes);
  setPixel(sprite, 6, 8, NIGHT_CAT_COLORS.pink);
  setPixel(sprite, 6, 9, NIGHT_CAT_COLORS.outline);
  drawLine(sprite, 2, 8, 3, 8, NIGHT_CAT_COLORS.stripe);
  drawLine(sprite, 9, 8, 10, 8, NIGHT_CAT_COLORS.stripe);
  drawLine(sprite, 2, 10, 3, 9, NIGHT_CAT_COLORS.stripe);
  drawLine(sprite, 10, 10, 9, 9, NIGHT_CAT_COLORS.stripe);
  drawNightCatSprite(frame, sprite, x, y, goingRight);
}

function drawSleepingNightCat(frame, x, y, phase) {
  const sprite = createFrame(COLORS.black);
  drawNightCatEllipse(sprite, 12, 11, 8, 4);
  if (phase === 2 || phase === 3) drawLine(sprite, 9, 6, 12, 6, NIGHT_CAT_COLORS.fur);
  drawNightCatTail(sprite, [[3, 11], [4, 13], [6, 14], [10, 14], [12, 13], [12, 12], [10, 12]], NIGHT_CAT_COLORS.fur);
  drawNightCatFace(sprite, 21);
  drawNightCatEars(sprite, 17, 25);
  drawLine(sprite, 19, 4, 20, 5, NIGHT_CAT_COLORS.stripe);
  drawLine(sprite, 23, 4, 22, 5, NIGHT_CAT_COLORS.stripe);
  setPixel(sprite, 21, 4, NIGHT_CAT_COLORS.stripe);
  drawRect(sprite, 20, 9, 3, 2, NIGHT_CAT_COLORS.light);
  drawLine(sprite, 18, 7, 19, 7, NIGHT_CAT_COLORS.eyes);
  setPixel(sprite, 17, 6, NIGHT_CAT_COLORS.eyes);
  drawLine(sprite, 24, 7, 23, 7, NIGHT_CAT_COLORS.eyes);
  setPixel(sprite, 25, 6, NIGHT_CAT_COLORS.eyes);
  setPixel(sprite, 21, 8, NIGHT_CAT_COLORS.pink);
  setPixel(sprite, 21, 9, NIGHT_CAT_COLORS.outline);
  drawLine(sprite, 17, 8, 18, 8, NIGHT_CAT_COLORS.stripe);
  drawLine(sprite, 24, 8, 25, 8, NIGHT_CAT_COLORS.stripe);
  drawLine(sprite, 17, 10, 18, 9, NIGHT_CAT_COLORS.stripe);
  drawLine(sprite, 25, 10, 24, 9, NIGHT_CAT_COLORS.stripe);
  drawNightCatSprite(frame, sprite, x, y, false);
}

function drawNightCatFace(sprite, cx) {
  drawRect(sprite, cx - 5, 3, 11, 9, NIGHT_CAT_COLORS.outline);
  drawRect(sprite, cx - 6, 5, 13, 5, NIGHT_CAT_COLORS.outline);
  drawRect(sprite, cx - 4, 4, 9, 7, NIGHT_CAT_COLORS.fur);
  drawRect(sprite, cx - 5, 5, 11, 5, NIGHT_CAT_COLORS.fur);
}

function drawNightCatEllipse(sprite, cx, cy, rx, ry) {
  for (let sy = cy - ry; sy <= cy + ry; sy += 1) {
    for (let sx = cx - rx; sx <= cx + rx; sx += 1) {
      const outer = ((sx - cx) / rx) ** 2 + ((sy - cy) / ry) ** 2;
      if (outer > 1) continue;
      const inner = ((sx - cx) / (rx - 1)) ** 2 + ((sy - cy) / (ry - 1)) ** 2;
      setPixel(sprite, sx, sy, inner <= 1 ? NIGHT_CAT_COLORS.fur : NIGHT_CAT_COLORS.outline);
    }
  }
}

function drawNightCatEars(sprite, left, right) {
  for (let sy = 0; sy <= 3; sy += 1) {
    for (let dx = 0; dx <= sy; dx += 1) {
      const color = dx === 0 || dx === sy ? NIGHT_CAT_COLORS.outline
        : dx === 1 && sy === 2 ? NIGHT_CAT_COLORS.pink : NIGHT_CAT_COLORS.fur;
      setPixel(sprite, left + dx, sy, color);
      setPixel(sprite, right - dx, sy, color);
    }
  }
}

function drawNightCatTail(sprite, points, color) {
  points.slice(1).forEach(([x2, y2], index) => {
    const [x1, y1] = points[index];
    drawLine(sprite, x1 + 1, y1, x2 + 1, y2, NIGHT_CAT_COLORS.outline);
  });
  points.slice(1).forEach(([x2, y2], index) => {
    const [x1, y1] = points[index];
    drawLine(sprite, x1, y1, x2, y2, color);
  });
}

function drawNightCatSprite(frame, sprite, x, y, mirror) {
  for (let sy = 0; sy < 16; sy += 1) {
    for (let sx = 0; sx < 28; sx += 1) {
      const offset = (sy * SIZE + sx) * 3;
      const color = Array.from(sprite.subarray(offset, offset + 3));
      if (color.some(Boolean)) setPixel(frame, x + (mirror ? 27 - sx : sx), y + sy, color);
    }
  }
}
