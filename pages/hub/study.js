const lighting = document.querySelector("#lighting");
const openCatalog = document.querySelector("#open-catalog");
const catalog = document.querySelector("#catalog");
const catalogFilters = catalog.querySelector(".catalog-filters");
const catalogSections = [...catalog.querySelectorAll(".catalog-section[data-category]")];
const catalogEmpty = catalog.querySelector("#catalog-empty");
const recentSection = catalog.querySelector("#catalog-recent");
const flavorTrigger = document.querySelector("#flavor-trigger");
const flavorText = document.querySelector("#flavor-text");
const room = document.querySelector(".room");
const roomLinks = document.querySelector(".room-links");
const bookshelfCamera = room.querySelector(".bookshelf-camera");
const bookshelfArrival = room.querySelector(".bookshelf-arrival");
const bookshelfArt = [...room.querySelectorAll(".bookshelf-camera img, .bookshelf-lamp img")];
const stopCamera = room.querySelector(".stop-camera");
const destination = document.querySelector("#destination");
const destinationContent = destination.querySelector(".destination-content");
const destinationTitle = document.querySelector("#destination-title");
const destinationDescription = document.querySelector("#destination-description");
const destinationApps = document.querySelector("#destination-apps");
const launch = document.querySelector("#destination-launch");
const returnRoom = document.querySelector("#return-room");
const motion = matchMedia("(prefers-reduced-motion: no-preference)");
const parallax = matchMedia("(hover: hover) and (pointer: fine)");
const smallScreen = matchMedia("(max-width: 780px)");

const stops = {
  bookshelf: {
    description: "蔵書や資料を、棚を眺めるように探せる自分だけの図書館。",
    apps: ["room_library"]
  },
  games: {
    description: "矢印のパズルや数独で、ひと休み。",
    apps: ["arrow_journey", "sudoku"]
  },
  aviation: {
    description: "737-800の問題や学習ノートを探して、理解を深める。",
    apps: ["study737"]
  },
  terminal: {
    description: "交通と天気の確認、家計の記録、今夜のお店探し。",
    apps: ["lifeboard", "household_account_book", "izakaya_scout"]
  },
  window: {
    description: "地図で月や星の位置を調べて、撮影場所と時間を決める。",
    apps: ["celestiframe"],
    image: "window-look-up.webp"
  }
};

const stopActions = {
  games: {
    opening: "games-closed.webp",
    final: "games-arrival.webp",
    openingLayer: "games-box-closed",
    cutout: { layer: "games-lid", from: "opening" }
  },
  terminal: {
    opening: "terminal-arrival.webp",
    final: "terminal-open.webp",
    openingLayer: "terminal-ledger-closed",
    cutout: { layer: "terminal-page", from: "arrival" },
    effect: "terminal-screen"
  }
};

const RECENT_STORAGE_KEY = "hobbyHub.recentApps.v1";
const FLAVOR_STORAGE_KEY = "hobbyHub.flavorHistory.v1";
const FLAVOR_HISTORY_LIMIT = 5;
const flavorPeriods = window.HOBBY_HUB_FLAVOR_PERIODS || [];
const modules = readCatalog();
const modulesById = new Map(modules.map((module) => [module.id, module]));
let recentHistory = normalizeRecentHistory(readHistory(RECENT_STORAGE_KEY));
let flavorHistory = normalizeFlavorHistory(readHistory(FLAVOR_STORAGE_KEY));

const stopArt = new Map();
let previousPin;
let activeScene;

lighting.addEventListener("click", () => {
  const isDimmed = document.body.classList.toggle("dimmed");
  lighting.setAttribute("aria-pressed", String(!isDimmed));
});

function readCatalog() {
  let source;
  try {
    source = JSON.parse(document.querySelector("#hub-catalog").textContent);
  } catch {
    return [];
  }

  if (!Array.isArray(source)) return [];
  return source
    .filter((module) => module && typeof module.module_id === "string" && module.module_id
      && (module.enabled == null || module.enabled === true || module.enabled === "TRUE" || module.enabled === "true"))
    .map((module) => {
      const order = Number(module.display_order);
      return {
        id: module.module_id,
        name: String(module.module_name || "アプリ"),
        category: String(module.category || ""),
        description: String(module.short_description || module.description || ""),
        order: Number.isFinite(order) ? order : 0,
        href: launchUrl(module.target_url)
      };
    })
    .sort((a, b) => a.order - b.order);
}

function launchUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const { protocol } = new URL(value, document.baseURI);
    return protocol === "https:" || protocol === "http:" ? value : "";
  } catch {
    return "";
  }
}

function readHistory(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function writeHistory(key, history) {
  try {
    window.localStorage.setItem(key, JSON.stringify(history));
  } catch {
    // Browser storage may be denied or full.
  }
}

function normalizeRecentHistory(value) {
  if (!Array.isArray(value)) return [];
  const entries = new Map();
  for (const item of value) {
    if (!item || typeof item.moduleId !== "string" || !item.moduleId
      || !Number.isFinite(item.lastOpened) || item.lastOpened <= 0) continue;
    const existing = entries.get(item.moduleId);
    if (!existing || item.lastOpened > existing.lastOpened) {
      entries.set(item.moduleId, { moduleId: item.moduleId, lastOpened: item.lastOpened });
    }
  }
  return [...entries.values()].sort((a, b) => b.lastOpened - a.lastOpened).slice(0, 3);
}

function normalizeFlavorHistory(value) {
  if (!Array.isArray(value)) return [];
  const knownIds = new Set(flavorPeriods.flatMap((period) => period.messages.map((message) => message.id)));
  return value.filter((id, index) => typeof id === "string" && knownIds.has(id) && value.indexOf(id) === index)
    .slice(0, FLAVOR_HISTORY_LIMIT);
}

function setFlavorText() {
  const hour = new Date().getHours();
  const period = flavorPeriods.find((item) => hour >= item.startHour && hour < item.endHour);
  if (!period || !period.messages.length) return;
  const available = period.messages.filter((message) => !flavorHistory.includes(message.id));
  const candidates = available.length ? available : period.messages;
  const message = candidates[Math.floor(Math.random() * candidates.length)];
  flavorText.textContent = message.text;
  flavorHistory = [message.id, ...flavorHistory.filter((id) => id !== message.id)].slice(0, FLAVOR_HISTORY_LIMIT);
  writeHistory(FLAVOR_STORAGE_KEY, flavorHistory);
}

function configureLaunch(link, module) {
  link.href = module.href;
  link.dataset.moduleId = module.id;
}

function createCatalogItem(module) {
  const item = document.createElement("li");
  const row = document.createElement(module.href ? "a" : "div");
  row.className = "catalog-entry";
  if (module.href) configureLaunch(row, module);
  const name = document.createElement("strong");
  name.textContent = module.name;
  const description = document.createElement("span");
  description.textContent = module.href ? module.description : "WebアプリURL未設定";
  row.append(name, description);
  item.append(row);
  return item;
}

function renderCatalog(category) {
  const categories = new Set(catalogSections.map((section) => section.dataset.category));
  const selectedModules = modules.filter((module) => category === "all" || module.category === category);

  for (const section of catalogSections) {
    const items = selectedModules.filter((module) => (
      categories.has(module.category) ? module.category : "other"
    ) === section.dataset.category);
    section.querySelector("ul").replaceChildren(...items.map(createCatalogItem));
    section.hidden = items.length === 0;
  }

  catalogEmpty.hidden = selectedModules.length > 0;
  if (!catalogEmpty.hidden) {
    catalogEmpty.textContent = modules.length
      ? "このカテゴリには、まだアプリがありません。"
      : "登録済みのアプリがありません。";
  }
}

function renderRecent() {
  const focusId = recentSection.contains(document.activeElement) ? document.activeElement.dataset.moduleId : undefined;
  const list = recentSection.querySelector("ul");
  const items = recentHistory.map(({ moduleId }) => createCatalogItem(modulesById.get(moduleId)));
  list.replaceChildren(...items);
  recentSection.hidden = items.length === 0;
  if (focusId) {
    const link = [...list.querySelectorAll("a")].find((item) => item.dataset.moduleId === focusId);
    link?.focus({ preventScroll: true });
  }
}

function rememberLaunch(event) {
  const link = event.target.closest("a[data-module-id]");
  if (!link || event.defaultPrevented || (event.type === "auxclick" && event.button !== 1)) return;
  const { moduleId } = link.dataset;
  recentHistory = normalizeRecentHistory([
    { moduleId, lastOpened: Date.now() },
    ...recentHistory.filter((item) => item.moduleId !== moduleId)
  ]);
  writeHistory(RECENT_STORAGE_KEY, recentHistory);
  if (catalog.open) {
    requestAnimationFrame(() => {
      if (catalog.open) renderRecent();
    });
  }
}

function availableModules(stop) {
  return stops[stop].apps.map((id) => modulesById.get(id)).filter((module) => module?.href);
}

recentHistory = recentHistory.filter(({ moduleId }) => modulesById.get(moduleId)?.href);
renderCatalog("all");
for (const pin of roomLinks.querySelectorAll("[data-stop]")) {
  const { stop } = pin.dataset;
  const [module] = availableModules(stop);
  pin.hidden = !module;
  if (module && stops[stop].apps.length === 1) pin.querySelector("span").textContent = module.name;
}

flavorTrigger.addEventListener("click", setFlavorText);
document.addEventListener("click", rememberLaunch);
document.addEventListener("auxclick", rememberLaunch);
window.addEventListener("pageshow", () => {
  if (catalog.open) renderRecent();
});

catalogFilters.addEventListener("click", (event) => {
  const filter = event.target.closest("button[data-category]");
  if (!filter || filter.getAttribute("aria-pressed") === "true") return;
  catalogFilters.querySelector('[aria-pressed="true"]').setAttribute("aria-pressed", "false");
  filter.setAttribute("aria-pressed", "true");
  renderCatalog(filter.dataset.category);
});

openCatalog.addEventListener("click", () => {
  renderRecent();
  catalog.showModal();
});

catalog.addEventListener("click", (event) => {
  if (event.target !== catalog) return;

  const bounds = catalog.getBoundingClientRect();
  const inside = event.clientX >= bounds.left && event.clientX <= bounds.right
    && event.clientY >= bounds.top && event.clientY <= bounds.bottom;

  if (!inside) catalog.close();
});

function resetParallax() {
  room.style.removeProperty("--room-x");
  room.style.removeProperty("--room-y");
}

room.addEventListener("pointermove", (event) => {
  if (roomLinks.inert || !parallax.matches || !motion.matches) return;

  const bounds = room.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - 0.5;
  const y = (event.clientY - bounds.top) / bounds.height - 0.5;
  room.style.setProperty("--room-x", `${(x * 12).toFixed(2)}px`);
  room.style.setProperty("--room-y", `${(y * 10).toFixed(2)}px`);
});

room.addEventListener("pointerleave", resetParallax);

function isLoaded(image) {
  return image.complete && image.naturalWidth > 0;
}

function hasFailed(image) {
  return image.complete && image.naturalWidth === 0;
}

function showDestinationContent() {
  destinationContent.inert = false;

  if (document.activeElement === returnRoom) destinationTitle.focus({ preventScroll: true });
}

function finishTravel(scene) {
  scene.travel = undefined;
  if (scene.action) showStopArt(scene, false);
  room.dataset[scene.state] = "arrived";
  showDestinationContent();
}

function createWindowBreeze(still) {
  const breeze = document.createElement("div");
  breeze.className = "window-breeze";

  for (let index = 0; index < 3; index += 1) {
    const branch = document.createElement("div");
    branch.className = "window-branch";
    branch.append(still.cloneNode());
    breeze.append(branch);
  }

  return breeze;
}

function showStopArt(scene, allowTravel) {
  const still = isLoaded(scene.arrival) ? scene.arrival : scene.opening;
  if (!still || !isLoaded(still)) return false;

  still.className = "stop-still";
  const layers = [still];
  if (scene.stop === "window") layers.push(createWindowBreeze(still));
  if (allowTravel && scene.action) {
    const { openingLayer, cutout, effect } = scene.action;
    scene.opening.className = openingLayer;
    layers.push(scene.opening);
    if (cutout) {
      const croppedArt = scene[cutout.from].cloneNode();
      croppedArt.className = cutout.layer;
      layers.push(croppedArt);
    }
    if (effect) {
      const overlay = document.createElement("div");
      overlay.className = effect;
      layers.push(overlay);
    }
  }
  stopCamera.replaceChildren(...layers);
  return true;
}

function openScene(scene, allowTravel) {
  room.dataset.view = scene.stop;
  const hasStill = scene.camera === stopCamera ? showStopArt(scene, allowTravel) : isLoaded(scene.arrival);
  if (!hasStill) return false;

  room.dataset[scene.state] = "arrived";
  if (!allowTravel) return false;

  room.dataset[scene.state] = "moving";
  const travel = scene.camera.getAnimations().find(({ animationName }) => animationName === scene.animation);
  if (!travel) {
    if (scene.action) showStopArt(scene, false);
    room.dataset[scene.state] = "arrived";
    return false;
  }

  scene.travel = travel;
  travel.finished.then(() => {
    if (activeScene === scene && scene.travel === travel) finishTravel(scene);
  }, () => {
    // Returning to the room cancels the animation.
  });
  return true;
}

function shouldWaitForArt(scene, ready) {
  if (scene.opening) {
    if (hasFailed(scene.arrival)) return !scene.opening.complete;
    if (!motion.matches || hasFailed(scene.opening)) return !scene.arrival.complete;
    return !ready;
  }

  return !ready && (motion.matches || scene.stop !== "bookshelf") && !scene.art.some(hasFailed);
}

function continueSceneWait(scene, timedOut = false) {
  if (!scene || activeScene !== scene || scene.wait === undefined) return;

  const ready = scene.art.every(isLoaded);
  if (!timedOut && shouldWaitForArt(scene, ready)) return;

  clearTimeout(scene.wait);
  scene.wait = undefined;
  if (!openScene(scene, !timedOut && motion.matches && ready)) showDestinationContent();
}

function watchArt(image) {
  const onArtSettled = () => continueSceneWait(activeScene);
  image.addEventListener("load", onArtSettled);
  image.addEventListener("error", onArtSettled);
}

function loadStopArt(source) {
  const cached = stopArt.get(source);
  if (cached && !hasFailed(cached)) return cached;

  const arrival = new Image(1448, 1086);
  arrival.alt = "";
  watchArt(arrival);
  arrival.src = "./assets/night-study/" + source;
  stopArt.set(source, arrival);
  return arrival;
}

function selectScene(stop) {
  const isBookshelf = stop === "bookshelf";
  const action = stopActions[stop];
  const arrival = isBookshelf ? bookshelfArrival : loadStopArt(action?.final ?? stops[stop].image ?? `${stop}-arrival.webp`);
  const opening = action ? loadStopArt(action.opening) : undefined;
  const scene = {
    stop,
    action,
    arrival,
    opening,
    art: isBookshelf ? bookshelfArt : opening ? [arrival, opening] : [arrival],
    camera: isBookshelf ? bookshelfCamera : stopCamera,
    state: isBookshelf ? "bookshelfScene" : "arrivalScene",
    animation: isBookshelf ? "bookshelf-arrival" : action ? "action-arrival" : "stop-arrival"
  };
  activeScene = scene;

  const ready = scene.art.every(isLoaded);
  if (!shouldWaitForArt(scene, ready)) return openScene(scene, motion.matches && ready);

  scene.wait = setTimeout(() => continueSceneWait(scene, true), 2500);
  return true;
}

bookshelfArt.forEach(watchArt);

motion.addEventListener("change", () => {
  if (motion.matches) return;
  if (activeScene?.travel) finishTravel(activeScene);
  continueSceneWait(activeScene);
});

function updateDestination(pin, stop) {
  const { description, apps } = stops[stop];
  const available = availableModules(stop);
  const isGroup = apps.length > 1;
  destinationTitle.textContent = isGroup ? pin.textContent.trim() : available[0].name;
  destinationDescription.textContent = description;
  launch.hidden = isGroup;
  destinationApps.hidden = !isGroup;

  if (isGroup) {
    launch.removeAttribute("href");
    delete launch.dataset.moduleId;
    const items = available.map((module) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      configureLaunch(link, module);
      link.textContent = module.name;
      item.append(link);
      return item;
    });
    destinationApps.replaceChildren(...items);
  } else {
    configureLaunch(launch, available[0]);
  }
}

roomLinks.addEventListener("click", (event) => {
  const pin = event.target.closest("button[data-stop]");
  if (!pin || pin.hidden || roomLinks.inert) return;

  previousPin = pin;
  const stop = pin.dataset.stop;

  resetParallax();
  room.classList.remove("returns-to-wide");
  roomLinks.inert = true;
  updateDestination(pin, stop);

  const waitingForScene = selectScene(stop);
  destinationContent.inert = waitingForScene;
  destination.hidden = false;
  (waitingForScene ? returnRoom : destinationTitle).focus({ preventScroll: true });

  if (smallScreen.matches) {
    room.scrollIntoView({ behavior: motion.matches ? "smooth" : "instant", block: "start" });
  }
});

function resetRoom() {
  clearTimeout(activeScene?.wait);
  activeScene?.travel?.cancel();
  activeScene = undefined;
  room.classList.add("returns-to-wide");
  delete room.dataset.bookshelfScene;
  delete room.dataset.arrivalScene;
  delete room.dataset.view;
  roomLinks.inert = false;
  destination.hidden = true;
  previousPin.focus({ preventScroll: true });
}

returnRoom.addEventListener("click", resetRoom);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && roomLinks.inert && !catalog.open) resetRoom();
});
