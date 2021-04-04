const { ipcMain, dialog, app, BrowserWindow, screen, globalShortcut, Menu } = require('electron')
const path = require('path')
const { Remarkable } = require('remarkable')
const remark = new Remarkable()
const fs = require('fs/promises')

const g_lineMap = new Map()
let g_srcLines = [];
let g_currentPath = '';

// store line number
const add_src_line_open = (tagname, tokens, idx) => {
    let line;
    if (tokens[idx].lines && tokens[idx].level == 0)
    {
        line = tokens[idx].lines[0]
        g_lineMap[line] = tokens[idx].lines
        return `<${tagname} src-line="${line}">`
    }
    return `<${tagname}>`

}

remark.renderer.rules.paragraph_open = (tokens, idx) => {
    return add_src_line_open('p', tokens, idx)
}

remark.renderer.rules.heading_open = (tokens, idx) => {
    let tagname = `h${tokens[idx].hLevel}`
    return add_src_line_open(tagname, tokens, idx)
}

remark.renderer.rules.bullet_list_open = (tokens, idx) => {
    return add_src_line_open('ul', tokens, idx)
}

remark.renderer.rules.ordered_list_open = (tokens, idx) => {
    return add_src_line_open('ol', tokens, idx)
}

remark.renderer.rules.blockquote_open = (tokens, idx) => {
    return add_src_line_open('blockquote', tokens, idx)
}

const reloadFile = (target) => {
    if (g_currentPath != "")
        openPath(g_currentPath, target)
}

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


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

const updateMd = (src, sender) => {
    g_lineMap.clear()
    sender.send('update-md', remark.render(src))
}

const openPath = async (filePath, sender) => {
    app.addRecentDocument(filePath)
    g_currentPath = filePath
    const cont = await fs.readFile( filePath )
    const src = cont.toString()
    g_srcLines = src.split('\n')
    updateMd(src, sender)
}

ipcMain.on('setup-done', async (event)=> {
    /*
    openPath( "/Users/arinokazuma/Google\ ドライブ/DriveText/wiki_and_informal.md",
     event.sender )
     */
})

const openFileDialog = async (targetWin) => {
    const {canceled, filePaths} = await dialog.showOpenDialog({
        properties: ['openFile', 'openDirectory'],
        filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if(!canceled) {
        openPath( filePaths[0], targetWin )
    }

}

ipcMain.on('line-click', async (event, line)=>{
    let target = []
    let [start, end] = g_lineMap[line]
    for( let i = start; i < end; i++ ) {
        target.push( g_srcLines[i] )
    }
    event.sender.send('start-edit', target.join('\n'), [start, end])
})

ipcMain.on('submit', async (event, text, [start, end])=>{
    let prev = g_srcLines
    g_srcLines = []
    for (let i = 0; i < start; i++) {
        g_srcLines[i] = prev[i]
    }
    text.split('\n').forEach(line => g_srcLines.push(line))
    for(let i = end; i < prev.length; i++) {
        g_srcLines.push(prev[i])
    }
    let src = g_srcLines.join('\n')
    await fs.writeFile(g_currentPath, src)
    updateMd(src, event.sender)
})

ipcMain.on('open-file', async (event, file)=> {
    openPath( file, event.sender )
})

const g_pendingFile = []

const handleOpenFile = (path) => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
    openPath(path, BrowserWindow.getFocusedWindow())
}

app.on('open-file', (event, path)=> {
    if(path.endsWith(".md")) {
        event.preventDefault()
        if (!app.isReady())
        {
            g_pendingFile.push(path)
            return
        }
        handleOpenFile(path)
    }
})

const isMac = process.platform === 'darwin'

const template = [
  ...(isMac ? [{ role: 'appMenu'}] : []),
  {
    label: 'File',
    submenu: [
        {
            label: "Open",
            accelerator: 'CmdOrCtrl+O',
            click: async (item, focusedWindow)=> {
                openFileDialog(focusedWindow)
            }
        },
        {
            label: "Open Recent",
            role: "recentDocuments",
            submenu: [
                {
                    label: "Clear Recent",
                    role: "clearRecentDocuments"
                }
            ]
        },
        isMac ? { role: 'close' } : { role: 'quit' }
    ]
  },
  { role: 'editMenu' },
  {
    label: 'View',
    submenu: [
      {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: (item, focusedWindow)=> {
              reloadFile( focusedWindow )
          }
      },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  { role: 'windowMenu' },
  {
    label: 'Developer',
    submenu: [
        { role: 'toggleDevTools' }
    ]
  },
  /*
  ,
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click: async () => {
          const { shell } = require('electron')
          await shell.openExternal('https://electronjs.org')
        }
      }
    ]
  }
  */
]

app.whenReady().then(() => {
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)

    createWindow()

    if (g_pendingFile.length != 0)
    {
        handleOpenFile(g_pendingFile[0])
        g_pendingFile.clear()
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

