const { ipcMain, dialog, app, BrowserWindow, screen } = require('electron')
const path = require('path')
const { Remarkable } = require('remarkable')
const remark = new Remarkable()
const fs = require('fs/promises')

function createWindow () {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const win = new BrowserWindow({
      width: width,
      height: height,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js')
      }
    })
  
    win.loadFile('index.html')
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})


ipcMain.on('open-file-dialog', async (event)=>{
    const {canceled, filePaths} = await dialog.showOpenDialog({
        properties: ['openFile', 'openDirectory'],
        filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if(!canceled) {
        const cont = await fs.readFile( filePaths[0] )
        event.sender.send('update-md', remark.render(cont.toString()))
    }
})