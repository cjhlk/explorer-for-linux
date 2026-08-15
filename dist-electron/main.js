import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promises } from "node:fs";
import { execFile, spawn } from "node:child_process";
import { homedir, platform } from "node:os";
import { promisify } from "node:util";
const execFileAsync$1 = promisify(execFile);
const DATA_HOME = process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share");
const ICON_THEME_ROOTS = [
  path.join(DATA_HOME, "icons"),
  "/usr/local/share/icons",
  "/usr/share/icons",
  "/usr/share/pixmaps"
];
const SIZES = [512, 256, 128, 96, 64, 48, 32, 24, 22, 16];
const CATEGORIES = ["mimetypes", "apps", "places", "devices", "status", "emblems", "actions"];
const EXT_ICON_FALLBACK = {
  folder: "folder",
  drive: "drive-harddisk",
  image: "image-x-generic",
  video: "video-x-generic",
  audio: "audio-x-generic",
  archive: "application-x-archive",
  pdf: "application-pdf",
  text: "text-x-generic",
  code: "text-x-generic",
  word: "x-office-document",
  excel: "x-office-spreadsheet",
  powerpoint: "x-office-presentation",
  app: "application-x-executable",
  font: "font-x-generic",
  database: "text-x-generic",
  link: "emblem-symbolic-link",
  generic: "text-x-generic"
};
const EXT_GROUPS = [
  { group: "image", exts: ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico", "avif", "heic", "tiff", "raw"] },
  { group: "video", exts: ["mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", "m4v", "ts", "m2ts", "ogv"] },
  { group: "audio", exts: ["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus", "wma", "mid", "midi"] },
  { group: "archive", exts: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "zst", "iso", "deb", "rpm", "tgz", "snap"] },
  { group: "pdf", exts: ["pdf"] },
  { group: "text", exts: ["txt", "log", "md", "csv", "conf", "ini", "cfg", "env", "yml", "yaml", "json", "xml", "toml", "sh", "bash", "zsh"] },
  { group: "code", exts: ["js", "jsx", "ts", "tsx", "vue", "py", "c", "h", "cpp", "hpp", "java", "go", "rs", "rb", "php", "sql", "html", "css", "scss", "sass", "lua", "swift", "kt", "dart"] },
  { group: "word", exts: ["doc", "docx", "odt", "rtf", "wps"] },
  { group: "excel", exts: ["xls", "xlsx", "ods", "csv"] },
  { group: "powerpoint", exts: ["ppt", "pptx", "odp"] },
  { group: "app", exts: ["AppImage", "exe", "run", "bin", "out"] },
  { group: "font", exts: ["ttf", "otf", "woff", "woff2"] },
  { group: "database", exts: ["db", "sqlite", "sqlite3"] }
];
function fallbackIconForExtension(extension) {
  const ext = extension.toLowerCase();
  for (const group of EXT_GROUPS) {
    if (group.exts.includes(ext)) return EXT_ICON_FALLBACK[group.group];
  }
  return EXT_ICON_FALLBACK.generic;
}
let cachedTheme = null;
async function getIconTheme() {
  if (cachedTheme) return cachedTheme;
  try {
    const { stdout } = await execFileAsync$1("gsettings", ["get", "org.gnome.desktop.interface", "icon-theme"], { timeout: 2e3 });
    const value = stdout.trim().replace(/^'|'$/g, "");
    if (value) {
      cachedTheme = value;
      return value;
    }
  } catch {
  }
  try {
    const ini = await promises.readFile(path.join(homedir(), ".config", "gtk-3.0", "settings.ini"), "utf8");
    const match = ini.match(/gtk-icon-theme-name\s*=\s*(.+)/i);
    if (match == null ? void 0 : match[1]) {
      cachedTheme = match[1].trim();
      return cachedTheme;
    }
  } catch {
  }
  cachedTheme = "Adwaita";
  return cachedTheme;
}
async function pathExists(target) {
  try {
    await promises.access(target);
    return true;
  } catch {
    return false;
  }
}
async function readInherits(themeRoot, theme) {
  try {
    const content = await promises.readFile(path.join(themeRoot, theme, "index.theme"), "utf8");
    const match = content.match(/Inherits\s*=\s*(.+)/i);
    return match ? match[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}
async function findIconInRoot(themeRoot, theme, name) {
  const base = path.join(themeRoot, theme);
  const direct = [
    path.join(base, "scalable", `${name}.svg`),
    path.join(base, "scalable", "mimetypes", `${name}.svg`),
    path.join(base, "scalable", "apps", `${name}.svg`),
    path.join(base, "scalable", "places", `${name}.svg`),
    path.join(base, "scalable", "devices", `${name}.svg`),
    path.join(base, "scalable", "status", `${name}.svg`)
  ];
  for (const candidate of direct) {
    if (await pathExists(candidate)) return candidate;
  }
  for (const size of SIZES) {
    for (const category of CATEGORIES) {
      for (const ext of ["png", "svg"]) {
        const candidate = path.join(base, String(size), category, `${name}.${ext}`);
        if (await pathExists(candidate)) return candidate;
      }
    }
  }
  return null;
}
const iconFileCache = /* @__PURE__ */ new Map();
async function resolveIconFile(name) {
  if (!name) return null;
  if (iconFileCache.has(name)) return iconFileCache.get(name) ?? null;
  const theme = await getIconTheme();
  const visited = /* @__PURE__ */ new Set();
  const queue = [theme, "hicolor"];
  let found = null;
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    for (const root of ICON_THEME_ROOTS) {
      const file = await findIconInRoot(root, current, name);
      if (file) {
        found = file;
        break;
      }
    }
    if (found) break;
    for (const root of ICON_THEME_ROOTS) {
      const inherits = await readInherits(root, current);
      for (const inherit of inherits) {
        if (!visited.has(inherit) && !queue.includes(inherit)) queue.push(inherit);
      }
    }
  }
  iconFileCache.set(name, found);
  return found;
}
async function fileToDataUrl(file) {
  try {
    const buffer = await promises.readFile(file);
    const mime = file.endsWith(".svg") ? "image/svg+xml" : "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
const dataUrlCache = /* @__PURE__ */ new Map();
async function resolveIconDataUrl(name) {
  if (dataUrlCache.has(name)) return dataUrlCache.get(name) ?? null;
  const file = await resolveIconFile(name);
  const dataUrl = file ? await fileToDataUrl(file) : null;
  dataUrlCache.set(name, dataUrl);
  return dataUrl;
}
async function queryIconNames(paths) {
  const results = paths.map(() => []);
  if (!paths.length) return results;
  try {
    const script = 'for p in "$@"; do gio info -a standard::icon "$p" 2>/dev/null | sed -n "s/^[[:space:]]*standard::icon:[[:space:]]*//p" | head -1 | tr -d "\\n"; echo; done';
    const child = spawn("sh", ["-c", script, "sh", ...paths], { stdio: ["ignore", "pipe", "ignore"] });
    const stdout = await new Promise((resolve) => {
      let out = "";
      child.stdout.on("data", (chunk) => {
        out += chunk.toString();
      });
      child.on("close", () => resolve(out));
      child.on("error", () => resolve(""));
      setTimeout(() => resolve(out), 15e3);
    });
    const lines = stdout.split("\n");
    for (let i = 0; i < paths.length; i++) {
      results[i] = (lines[i] ?? "").split(",").map((name) => name.trim()).filter(Boolean);
    }
  } catch {
  }
  return results;
}
async function resolveIcons(requests) {
  const fileRequests = requests.filter((request) => !request.name);
  const candidateNames = /* @__PURE__ */ new Map();
  for (let i = 0; i < requests.length; i++) {
    if (requests[i].name) candidateNames.set(i, [requests[i].name]);
  }
  if (fileRequests.length) {
    const detected = await queryIconNames(fileRequests.map((request) => request.path));
    let fileIndex = 0;
    for (let i = 0; i < requests.length; i++) {
      if (candidateNames.has(i)) continue;
      const request = requests[i];
      let candidates = detected[fileIndex];
      if (!candidates.length) {
        candidates = request.isDirectory ? ["folder"] : [fallbackIconForExtension(path.extname(request.path).slice(1))];
      }
      candidateNames.set(i, candidates);
      fileIndex += 1;
    }
  }
  const responses = [];
  for (let i = 0; i < requests.length; i++) {
    let dataUrl = null;
    for (const name of candidateNames.get(i) ?? []) {
      const resolved = await resolveIconDataUrl(name);
      if (resolved) {
        dataUrl = resolved;
        break;
      }
    }
    responses.push({ path: requests[i].path, dataUrl });
  }
  return responses;
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win = null;
const execFileAsync = promisify(execFile);
function sendToRenderer(channel, payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}
function createWindow() {
  win = new BrowserWindow({
    title: "Explorer",
    icon: path.join(process.env.VITE_PUBLIC, "explorer.svg"),
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    frame: false,
    show: false,
    backgroundColor: "#F3F3F3",
    webPreferences: {
      preload: path.join(__dirname$1, "preload.cjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.on("ready-to-show", () => win == null ? void 0 : win.show());
  const broadcastMaximize = () => sendToRenderer("win:maximized-change", (win == null ? void 0 : win.isMaximized()) ?? false);
  win.on("maximize", broadcastMaximize);
  win.on("unmaximize", broadcastMaximize);
  win.webContents.on("did-finish-load", () => {
    sendToRenderer("win:maximized-change", (win == null ? void 0 : win.isMaximized()) ?? false);
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
async function listDir(dirPath) {
  let dirents;
  try {
    dirents = await promises.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    throw new Error(error.message);
  }
  const entries = [];
  const stats = /* @__PURE__ */ new Map();
  const STAT_CONCURRENCY = 64;
  for (let i = 0; i < dirents.length; i += STAT_CONCURRENCY) {
    const batch = dirents.slice(i, i + STAT_CONCURRENCY);
    const results = await Promise.all(batch.map(async (dirent) => {
      const full = path.join(dirPath, dirent.name);
      try {
        return [full, await promises.lstat(full)];
      } catch {
        return [full, null];
      }
    }));
    for (const [full, stat] of results) {
      if (stat) stats.set(full, stat);
    }
  }
  for (const dirent of dirents) {
    const full = path.join(dirPath, dirent.name);
    const stat = stats.get(full);
    entries.push({
      name: dirent.name,
      path: full,
      isDirectory: dirent.isDirectory(),
      isFile: dirent.isFile(),
      isSymlink: dirent.isSymbolicLink(),
      size: (stat == null ? void 0 : stat.size) ?? 0,
      mtime: (stat == null ? void 0 : stat.mtimeMs) ?? 0,
      mode: (stat == null ? void 0 : stat.mode) ?? 0,
      extension: dirent.isDirectory() ? "" : path.extname(dirent.name).slice(1).toLowerCase()
    });
  }
  return entries;
}
async function statPath(target) {
  try {
    const stats = await promises.lstat(target);
    return {
      name: path.basename(target),
      path: target,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isSymlink: stats.isSymbolicLink(),
      size: stats.size,
      mtime: stats.mtimeMs,
      mode: stats.mode,
      extension: stats.isDirectory() ? "" : path.extname(target).slice(1).toLowerCase()
    };
  } catch {
    return null;
  }
}
const MOUNT_INFO = "/proc/self/mounts";
const DISK_FS_TYPES = /* @__PURE__ */ new Set(["ext2", "ext3", "ext4", "btrfs", "xfs", "f2fs", "vfat", "exfat", "ntfs", "ntfs3", "hfsplus", "zfs", "jfs", "reiserfs", "nilfs2", "bcachefs", "apfs", "erofs"]);
async function readMounts() {
  let data;
  try {
    data = await promises.readFile(MOUNT_INFO, "utf8");
  } catch {
    return [];
  }
  const seen = /* @__PURE__ */ new Set();
  const mounts = [];
  const lines = data.split("\n");
  const home = homedir();
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const [device, mountpoint, fsType, optionsRaw] = line.split(" ");
    if (!mountpoint || !fsType || !optionsRaw) continue;
    if (mountpoint.startsWith("/sys") || mountpoint.startsWith("/proc") || mountpoint.startsWith("/dev") || mountpoint.startsWith("/run") || mountpoint === "/snap") continue;
    if (mountpoint !== "/" && !device.startsWith("/dev/") && !DISK_FS_TYPES.has(fsType)) continue;
    if (seen.has(mountpoint)) continue;
    const options = optionsRaw.split(",");
    seen.add(mountpoint);
    let total = null;
    let free = null;
    try {
      const sfs = await promises.statfs(mountpoint);
      total = sfs.blocks * sfs.bsize;
      free = sfs.bavail * sfs.bsize;
    } catch {
    }
    if (mountpoint === "/") ;
    else {
      path.basename(mountpoint);
    }
    mounts.push({
      device,
      path: mountpoint,
      fsType,
      options,
      isRemovable: mountpoint === home ? false : mountpoint.startsWith("/media/") || mountpoint.startsWith("/run/media/") || mountpoint.startsWith("/mnt/"),
      isReadonly: options.includes("ro"),
      total,
      free
    });
  }
  return mounts;
}
function spawnDetached(command, args) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { detached: true, stdio: "ignore" });
    } catch (error) {
      resolve({ ok: false, error: error.message });
      return;
    }
    child.on("error", (error) => resolve({ ok: false, error: error.message }));
    child.on("spawn", () => {
      child.unref();
      resolve({ ok: true });
    });
  });
}
async function commandExists(command) {
  return new Promise((resolve) => {
    const probe = spawn("sh", ["-c", `command -v "${command}"`], { stdio: "ignore" });
    probe.on("error", () => resolve(false));
    probe.on("exit", (code) => resolve(code === 0));
  });
}
async function openPath(target) {
  const result = await spawnDetached("xdg-open", [target]);
  if (result.ok) return result;
  const gioResult = await spawnDetached("gio", ["open", target]);
  if (gioResult.ok) return gioResult;
  return { ok: false, error: "No application found to open this item" };
}
const TERMINALS = [
  { command: "konsole", args: (dir) => ["--workdir", dir] },
  { command: "gnome-terminal", args: (dir) => ["--working-directory", dir] },
  { command: "kitty", args: (dir) => ["--directory", dir] },
  { command: "alacritty", args: (dir) => ["--working-directory", dir] },
  { command: "wezterm", args: (dir) => ["start", "--cwd", dir] },
  { command: "xfce4-terminal", args: (dir) => ["--working-directory", dir] },
  { command: "tilix", args: (dir) => ["--working-directory", dir] },
  { command: "terminator", args: (dir) => ["--working-directory", dir] },
  { command: "xterm", args: (dir) => ["-e", "bash", "-lc", `cd '${dir}' && exec bash`] }
];
async function openTerminal(dir) {
  for (const candidate of TERMINALS) {
    if (!await commandExists(candidate.command)) continue;
    const result = await spawnDetached(candidate.command, candidate.args(dir));
    if (result.ok) return result;
  }
  return { ok: false, error: "No supported terminal emulator found" };
}
async function ensureUnique(target) {
  const dir = path.dirname(target);
  const ext = path.extname(target);
  const base = path.basename(target, ext);
  let candidate = target;
  let counter = 1;
  while (true) {
    try {
      await promises.access(candidate);
    } catch {
      return candidate;
    }
    candidate = path.join(dir, `${base} (${counter})${ext}`);
    counter += 1;
  }
}
async function copyRecursive(source, destination) {
  const stats = await promises.lstat(source);
  if (stats.isDirectory()) {
    await promises.mkdir(destination, { recursive: true });
    const children = await promises.readdir(source);
    for (const child of children) {
      await copyRecursive(path.join(source, child), path.join(destination, child));
    }
    return;
  }
  if (stats.isSymbolicLink()) {
    const link = await promises.readlink(source);
    await promises.symlink(link, destination);
    return;
  }
  await promises.copyFile(source, destination);
}
async function removeRecursive(target) {
  await promises.rm(target, { recursive: true, force: true });
}
async function transfer(source, destDir, move) {
  let target = await ensureUnique(path.join(destDir, path.basename(source)));
  try {
    if (move) {
      try {
        await promises.rename(source, target);
        return { ok: true };
      } catch (error) {
        const code = error.code;
        if (code !== "EXDEV") throw error;
        await copyRecursive(source, target);
        await removeRecursive(source);
        return { ok: true };
      }
    }
    await copyRecursive(source, target);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
async function manualTrash(target) {
  try {
    const trashRoot = path.join(homedir(), ".local", "share", "Trash");
    const filesDir = path.join(trashRoot, "files");
    const infoDir = path.join(trashRoot, "info");
    await promises.mkdir(filesDir, { recursive: true });
    await promises.mkdir(infoDir, { recursive: true });
    const name = path.basename(target);
    let destName = name;
    let counter = 1;
    while (true) {
      try {
        await promises.access(path.join(filesDir, destName));
        destName = `${name}.${counter}`;
        counter += 1;
      } catch {
        break;
      }
    }
    await promises.rename(target, path.join(filesDir, destName));
    const date = (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z/, "Z");
    const info = `[Trash Info]
Path=${target.replace(/%/g, "%25").replace(/&/g, "&amp;")}
DeletionDate=${date}
`;
    await promises.writeFile(path.join(infoDir, `${destName}.trashinfo`), info);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
async function trashPath(target) {
  if (await commandExists("gio")) {
    const result = await execFileAsync("gio", ["trash", target]).then(
      () => ({ ok: true }),
      (error) => ({ ok: false, error: error.message })
    );
    if (result.ok) return result;
  }
  if (await commandExists("trash-put")) {
    const result = await execFileAsync("trash-put", [target]).then(
      () => ({ ok: true }),
      (error) => ({ ok: false, error: error.message })
    );
    if (result.ok) return result;
  }
  return manualTrash(target);
}
function registerIpcHandlers() {
  ipcMain.handle("fs:list", async (_event, dirPath) => listDir(dirPath));
  ipcMain.handle("fs:icons", async (_event, requests) => resolveIcons(requests));
  ipcMain.handle("fs:stat", async (_event, target) => statPath(target));
  ipcMain.handle("fs:mounts", async () => readMounts());
  ipcMain.handle("app:info", async () => ({
    version: app.getVersion(),
    platform: platform(),
    home: homedir(),
    root: path.parse(process.cwd()).root
  }));
  ipcMain.handle("fs:open", async (_event, target) => openPath(target));
  ipcMain.handle("fs:open-terminal", async (_event, dir) => openTerminal(dir));
  ipcMain.handle("fs:mkdir", async (_event, dir, name) => {
    const target = await ensureUnique(path.join(dir, name));
    try {
      await promises.mkdir(target);
      return { ok: true, path: target };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle("fs:rename", async (_event, oldPath, newPath) => {
    try {
      await promises.rename(oldPath, newPath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle("fs:write-text", async (_event, dir, name, content) => {
    const target = await ensureUnique(path.join(dir, name));
    try {
      await promises.writeFile(target, content ?? "", { encoding: "utf8" });
      return { ok: true, path: target };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle("fs:trash", async (_event, target) => trashPath(target));
  ipcMain.handle("fs:copy", async (_event, source, destDir) => {
    if (path.dirname(source) === path.resolve(destDir)) return { ok: true };
    return transfer(source, destDir, false);
  });
  ipcMain.handle("fs:move", async (_event, source, destDir) => {
    if (path.dirname(source) === path.resolve(destDir)) return { ok: true };
    return transfer(source, destDir, true);
  });
  ipcMain.on("win:minimize", (event) => {
    var _a;
    (_a = BrowserWindow.fromWebContents(event.sender)) == null ? void 0 : _a.minimize();
  });
  ipcMain.on("win:toggle-maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.on("win:close", (event) => {
    var _a;
    (_a = BrowserWindow.fromWebContents(event.sender)) == null ? void 0 : _a.close();
  });
  ipcMain.handle("win:is-maximized", (event) => {
    var _a;
    return ((_a = BrowserWindow.fromWebContents(event.sender)) == null ? void 0 : _a.isMaximized()) ?? false;
  });
}
app.on("window-all-closed", () => {
  if (platform() !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
