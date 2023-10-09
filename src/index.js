import '@material/web/button/filled-button.js';
import '@material/web/button/filled-tonal-button.js';
import '@material/web/textfield/filled-text-field';
import '@material/web/icon/icon';
import '@material/web/progress/linear-progress'

import { getMinifiedCSS } from './utils.js'

document.querySelector('#css-file-form').addEventListener('submit', async e => {
  e.preventDefault()
  document.querySelector('md-linear-progress').style.display = 'block'
  await new Promise(res => setTimeout(res, 0))
  
  const fileUrl = document.querySelector("md-filled-text-field").value
  const response = await fetch(fileUrl)
  const cssText = await response.text()
  const styleSheet = new CSSStyleSheet()
  styleSheet.replaceSync(cssText)
  const minifiedCSS = getMinifiedCSS(styleSheet)

  const nestedCSSContainer = document.querySelector('#nested-css-container')
  nestedCSSContainer.removeAttribute('hidden')
  nestedCSSContainer.querySelector('#textarea-before').value = cssText
  nestedCSSContainer.querySelector('#textarea-after').value = minifiedCSS
  
  document.querySelector('md-linear-progress').style.display = 'none'
});

// TODO Show side-by-side comparison
// TODO compare KBs
