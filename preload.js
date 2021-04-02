const {ipcRenderer} = require('electron')

window.addEventListener('DOMContentLoaded', () => {

  document.getElementById('open-file').addEventListener('click', (event)=>{
      ipcRenderer.send('open-file-dialog')
  })
  
  const mdDiv = document.getElementById('md-div')

  ipcRenderer.on('update-md', (event, html) => {
    mdDiv.innerHTML = html;
  })
  
})
