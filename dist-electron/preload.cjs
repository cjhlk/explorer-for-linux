"use strict";
const electron = require("electron");
const api = {
  fs: {
    list: (dirPath) => electron.ipcRenderer.invoke("fs:list", dirPath),
    icons: (requests) => electron.ipcRenderer.invoke("fs:icons", requests),
    stat: (target) => electron.ipcRenderer.invoke("fs:stat", target),
    mounts: () => electron.ipcRenderer.invoke("fs:mounts"),
    open: (target) => electron.ipcRenderer.invoke("fs:open", target),
    openTerminal: (dir) => electron.ipcRenderer.invoke("fs:open-terminal", dir),
    mkdir: (dir, name) => electron.ipcRenderer.invoke("fs:mkdir", dir, name),
    rename: (oldPath, newPath) => electron.ipcRenderer.invoke("fs:rename", oldPath, newPath),
    writeText: (dir, name, content) => electron.ipcRenderer.invoke("fs:write-text", dir, name, content ?? ""),
    trash: (target) => electron.ipcRenderer.invoke("fs:trash", target),
    copy: (source, destDir) => electron.ipcRenderer.invoke("fs:copy", source, destDir),
    move: (source, destDir) => electron.ipcRenderer.invoke("fs:move", source, destDir)
  },
  app: {
    info: () => electron.ipcRenderer.invoke("app:info")
  },
  window: {
    minimize: () => electron.ipcRenderer.send("win:minimize"),
    toggleMaximize: () => electron.ipcRenderer.send("win:toggle-maximize"),
    close: () => electron.ipcRenderer.send("win:close"),
    isMaximized: () => electron.ipcRenderer.invoke("win:is-maximized"),
    onMaximizedChange: (callback) => {
      const listener = (_event, maximized) => callback(maximized);
      electron.ipcRenderer.on("win:maximized-change", listener);
      return () => {
        electron.ipcRenderer.removeListener("win:maximized-change", listener);
      };
    }
  }
};
electron.contextBridge.exposeInMainWorld("explorer", api);
