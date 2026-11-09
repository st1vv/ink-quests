import logoUrl from "@/img/logo.svg";
import { formatNumber } from "@/lib/format";

// What the share card shows; everything comes from data the page already has.
export type ShareCardData = {
  // Display name, or the short address when there's none.
  name: string;
  streak: number;
  level: number;
  totalXp: number;
  // 0-100: how far into the current level.
  levelProgress: number;
  // Monday to Sunday of the current UTC week: true where checked in.
  week: boolean[];
  // Leaderboard place; null until the user has any XP.
  rank: number | null;
  // Shown in the footer, e.g. "inkquests.xyz".
  host: string;
};

// 16:9, the size X shows uncropped in the timeline.
const WIDTH = 1200;
const HEIGHT = 675;
const PAD = 72;

const INK = "#7132f5";
const INK_LIGHT = "#a884ff";
const CANVAS = "#0a0a0c";
const FONT = "Inter, ui-sans-serif, system-ui, sans-serif";
const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

// The same flame as FlameIcon, in its 24x24 box.
const FLAME_OUTER = new Path2D(
  "M12 2c.6 3.2 2.6 5 4.3 7 1.5 1.8 2.7 3.6 2.7 6.2A7 7 0 0 1 12 22a7 7 0 0 1-7-6.8c0-2.4 1.1-4.4 2.7-5.9.3 1.6 1 2.8 2.2 3.5C9.4 8.9 10.4 5.2 12 2Z",
);
const FLAME_INNER = new Path2D(
  "M12 13c1.3 1.4 2.5 2.6 2.5 4.4A2.5 2.5 0 0 1 12 20a2.5 2.5 0 0 1-2.5-2.6c0-1.6 1.1-3 2.5-4.4Z",
);

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Canvas text only uses a web font once it's loaded; without this the first
// card can come out in the fallback font.
const loadFonts = () =>
  Promise.all(
    [600, 700, 800].map((weight) =>
      document.fonts.load(`${weight} 40px Inter`),
    ),
  ).catch(() => undefined);

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const drawFlame = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  lit: boolean,
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  if (lit) {
    const gradient = ctx.createLinearGradient(0, 22, 0, 2);
    gradient.addColorStop(0, INK);
    gradient.addColorStop(1, "#c4a8ff");
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.15)";
  }
  ctx.fill(FLAME_OUTER);
  ctx.fillStyle = lit ? "#ede4ff" : "rgba(255,255,255,0.1)";
  ctx.fill(FLAME_INNER);
  ctx.restore();
};

// A label over a big value, e.g. "TOTAL XP" / "12,450".
const drawStat = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
) => {
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText(label, x, y);
  ctx.fillStyle = "#fff";
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(value, x, y + 58);
};

export const renderShareCard = async (data: ShareCardData): Promise<Blob> => {
  const [logo] = await Promise.all([
    loadImage(logoUrl).catch(() => null),
    loadFonts(),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't supported in this browser");
  ctx.textBaseline = "alphabetic";

  // Background: the app's canvas color with two purple glows.
  ctx.fillStyle = CANVAS;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (const [cx, cy, r, alpha] of [
    [WIDTH, 0, 700, 0.45],
    [0, HEIGHT, 520, 0.25],
  ] as const) {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    glow.addColorStop(0, `rgba(113,50,245,${alpha})`);
    glow.addColorStop(1, "rgba(113,50,245,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // Header: logo, brand, and the player's name on the right.
  if (logo) ctx.drawImage(logo, PAD, PAD - 8, 56, 56);
  ctx.fillStyle = "#fff";
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText("InkQuests", PAD + (logo ? 72 : 0), PAD + 32);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText(data.name, WIDTH - PAD, PAD + 30);
  ctx.textAlign = "left";

  // Hero: the streak, with a big flame.
  const heroY = 250;
  drawFlame(ctx, PAD - 6, heroY - 92, 112, data.streak > 0);
  ctx.fillStyle = "#fff";
  ctx.font = `800 104px ${FONT}`;
  const streakText = `${data.streak}`;
  ctx.fillText(streakText, PAD + 116, heroY);
  const streakWidth = ctx.measureText(streakText).width;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText("day streak", PAD + 116 + streakWidth + 20, heroY);

  // This week's check-ins, on the right of the hero.
  const flameSize = 40;
  const gap = 18;
  const weekWidth = 7 * flameSize + 6 * gap;
  let wx = WIDTH - PAD - weekWidth;
  data.week.forEach((checkedIn, i) => {
    drawFlame(ctx, wx, heroY - 72, flameSize, checkedIn);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `600 16px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(WEEKDAYS[i], wx + flameSize / 2, heroY - 6);
    ctx.textAlign = "left";
    wx += flameSize + gap;
  });

  // Stats row inside a panel.
  const panelY = 310;
  const panelH = 190;
  roundRect(ctx, PAD, panelY, WIDTH - PAD * 2, panelH, 32);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const colW = (WIDTH - PAD * 2) / 3;
  const statY = panelY + 60;
  drawStat(ctx, PAD + 40, statY, "LEVEL", `${data.level}`);
  drawStat(ctx, PAD + 40 + colW, statY, "TOTAL XP", formatNumber(data.totalXp));
  drawStat(
    ctx,
    PAD + 40 + colW * 2,
    statY,
    "RANK",
    data.rank === null ? "—" : `#${formatNumber(data.rank)}`,
  );

  // Level progress bar along the bottom of the panel.
  const barX = PAD + 40;
  const barW = WIDTH - PAD * 2 - 80;
  const barY = panelY + panelH - 42;
  roundRect(ctx, barX, barY, barW, 12, 6);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fill();
  const filled = Math.max(12, (barW * Math.min(100, data.levelProgress)) / 100);
  const bar = ctx.createLinearGradient(barX, 0, barX + filled, 0);
  bar.addColorStop(0, INK);
  bar.addColorStop(1, INK_LIGHT);
  roundRect(ctx, barX, barY, filled, 12, 6);
  ctx.fillStyle = bar;
  ctx.fill();

  // Footer: the call to action and where to go.
  const footY = HEIGHT - PAD + 6;
  ctx.fillStyle = "#fff";
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText("Daily quests on Ink. Join me!", PAD, footY);
  ctx.textAlign = "right";
  ctx.fillStyle = INK_LIGHT;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(data.host, WIDTH - PAD, footY);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Couldn't create the image")),
      "image/png",
    ),
  );
};
