import '@material/web/button/filled-button'
import '@material/web/button/filled-tonal-button'
import '@material/web/textfield/filled-text-field'
import '@material/web/icon/icon'
import '@material/web/progress/linear-progress'
import '@material/web/elevation/elevation'
import '@material/web/checkbox/checkbox'
import '@material/web/divider/divider'
import '@material/web/fab/fab'

import { getMinifiedCSS, textToKBs } from './utils.js'

// TODO add CSS file upload button

const EXAMPLE_CSS_FILE_URL = 'https://www.w3.org/StyleSheets/Core/Modernist'

async function onSubmit(fileUrl) {
  showLoadingIndicator()
  await yieldToMain();

  if (!fileUrl) {
    fileUrl = EXAMPLE_CSS_FILE_URL
  }
  const [styleSheet, cssText] = await fetchAndCreateStylesheet(fileUrl);
  const minifyEnabled = document.querySelector('#minify-css-checkbox').checked
  const minifiedCSS = getMinifiedCSS(styleSheet, minifyEnabled)
  
  displayResults(cssText, minifiedCSS)
  hideLoadingIndicator()
}

document.querySelector('#css-file-form').addEventListener('submit', async e => {
  e.preventDefault()
  const fileUrl = document.querySelector("md-filled-text-field").value
  onSubmit(fileUrl)
});

document.querySelector('#example-button').addEventListener('click', () => onSubmit())

async function fetchAndCreateStylesheet(url) {
  const response = await fetch(url)
  const cssText = await response.text()
  const styleSheet = new CSSStyleSheet()
  styleSheet.replaceSync(cssText)
  return [styleSheet, cssText]
}

function displayResults(before, after) {
  const nestedCSSContainer = document.querySelector('#nested-css-container')
  nestedCSSContainer.removeAttribute('hidden')
  nestedCSSContainer.querySelector('#textarea-before').value = before
  nestedCSSContainer.querySelector('#textarea-after').value = after
  // show character length comparison - assuming UTF-8 encoding - 1 character = 1 byte
  nestedCSSContainer.querySelector('.before .file-weight').textContent = `Original: ${textToKBs(before)} KBs`
  nestedCSSContainer.querySelector('.after .file-weight').textContent = `With Nesting: ${textToKBs(after)} KBs`

  const copyButton = nestedCSSContainer.querySelector('.after #copy-button')
  copyButton.addEventListener('click', () => {
    const copied = copyToClipboard(after)
    if (copied) {
      const copyButtonIcon = copyButton.querySelector('md-icon')
      const currentIcon = copyButtonIcon.innerText
      copyButtonIcon.innerText = 'done'
      copyButton.style.setProperty('--md-fab-container-color', '#4CAF50')
      
      setTimeout(() => {
        copyButtonIcon.innerText = currentIcon
        copyButton.style.removeProperty('--md-fab-container-color')
      }, 3000);
    }
  })
}

function showLoadingIndicator() {
  document.querySelector('md-linear-progress').style.display = 'block'
}

function hideLoadingIndicator() {
  document.querySelector('md-linear-progress').style.display = 'none'
}

function yieldToMain() {
  if ('scheduler' in window && 'yield' in scheduler) {
    return scheduler.yield();
  }
  return new Promise(res => setTimeout(res, 0))
}

async function copyToClipboard (text) {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (_) {
    // Async Clipboard API is not supported
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    const result = document.execCommand('copy')
    document.body.removeChild(el)
    return result !== 'unsuccessful'
  }
}