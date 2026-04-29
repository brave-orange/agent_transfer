const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Invoke main process
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  // Listen to main process events
  on: (channel, func) => {
    const subscription = (_event, ...args) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },

  // Send to main process
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
});
