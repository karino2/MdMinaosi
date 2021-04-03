const {ipcRenderer} = require('electron')


window.addEventListener('DOMContentLoaded', () => {

  document.getElementById('open-file').addEventListener('click', (event)=>{
      ipcRenderer.send('open-file-dialog')
  })

  document.getElementById('reload-file').addEventListener('click', (event)=>{
    ipcRenderer.send('reload-file')
  })

  const mdDiv = document.getElementById('md-div')

  ipcRenderer.on('update-md', (event, html) => {
    mdDiv.innerHTML = html
  })

  let lastSelected = null
  let targetRange = [0, 0]

  const onBodyClick = (event) => {
    const findTaretTopElem = (start) => {
      if (start.tagName == "body")
        return null
      if (start == mdDiv)
        return null
      let cur = start
      let prev = cur
      while (cur != mdDiv) {
        let sline = cur.getAttribute('src-line')
        if (sline != null)
          return cur
        prev = cur
        cur = cur.parentElement
  
        // not md-div child
        if (cur == null)
          return null
      }
      return prev
    }
    let topelem = findTaretTopElem(event.target) 
    if (!topelem)
      return
    const sline = topelem.getAttribute('src-line')
    if (sline != null)
    {
      lastSelected = topelem
      ipcRenderer.send("line-click", parseInt(sline))
    }
  }

  const body = document.getElementById("body")
  body.addEventListener('click', onBodyClick)

  const editDiv = document.getElementById("edit-div")
  const editArea = editDiv.querySelector(".edit-area")

  ipcRenderer.on('start-edit', (event, html, [start, end]) => {
    targetRange = [start, end]
    lastSelected.insertAdjacentElement('afterend', editDiv)
    editArea.value = html
    editArea.rows = Math.max((end-start), 3);
    editDiv.style.display = 'block'
  })
  document.getElementById('cancel-edit').addEventListener('click', ()=>{
    editDiv.style.display = 'none'
  })

  document.getElementById('submit-edit').addEventListener('click', ()=>{
    ipcRenderer.send('submit', editArea.value, targetRange)
    editDiv.style.display = 'none'
  })

  document.addEventListener('dragover', (event)=> {
    event.preventDefault();
  })

  document.addEventListener('drop', (event)=> {
    event.preventDefault();
    event.stopPropagation();
  
    ipcRenderer.send('open-file', event.dataTransfer.files[0].path)
  })

  ipcRenderer.send("setup-done")

})
