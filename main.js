const { ipcMain, dialog, app, BrowserWindow, screen, globalShortcut } = require('electron')
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

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
        }
    })

    globalShortcut.register("CommandOrControl+R", ()=>{
        let cur = BrowserWindow.getFocusedWindow()
        if (cur != null)
            reloadFile(cur)
    })
})

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

ipcMain.on('open-file-dialog', async (event)=>{
    const {canceled, filePaths} = await dialog.showOpenDialog({
        properties: ['openFile', 'openDirectory'],
        filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if(!canceled) {
        console.log(filePaths[0])
        openPath( filePaths[0], event.sender )
    }
})

ipcMain.on('reload-file', async (event)=>{
    reloadFile(event.sender)
})


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
