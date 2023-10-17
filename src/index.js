import '@material/web/button/filled-button'
import '@material/web/button/filled-tonal-button'
import '@material/web/iconbutton/filled-tonal-icon-button'
import '@material/web/textfield/filled-text-field'
import '@material/web/icon/icon'
import '@material/web/progress/linear-progress'
import '@material/web/elevation/elevation'
import '@material/web/checkbox/checkbox'
import '@material/web/divider/divider'
import '@material/web/fab/fab'
import '@material/web/switch/switch'

import { getMinifiedCSS, textToKBs } from './utils.js'

// TODO add CSS file upload button

// https://github.githubassets.com/assets/primer-d6dcdf72e61d.css
const EXAMPLE_CSS_FILE_URL = 'https://www.w3.org/StyleSheets/Core/Modernist'

async function onSubmit(fileUrl) {
  showLoadingIndicator()

  if (!fileUrl) {
    fileUrl = EXAMPLE_CSS_FILE_URL
  }
  const results = await fetchAndCreateStylesheet(fileUrl)
  if (!results) {
    return
  }
  const [styleSheet, cssText] = results
  displayResults(styleSheet, cssText)
  hideLoadingIndicator()
}

document.querySelector('#css-file-form [type="url"]').addEventListener('input', e => {
  setTimeout(() => {
    const input = e.target
    const submitButton = document.querySelector('#css-file-form [type="submit"]')
    submitButton.disabled = !(input.checkValidity() && input.value?.length)
  }, 0)
})

document.querySelector('#css-file-form').addEventListener('submit', async e => {
  e.preventDefault()
  const fileUrl = document.querySelector("md-filled-text-field").value
  onSubmit(fileUrl)
});

document.querySelector('#example-button').addEventListener('click', () => onSubmit())

document.querySelector('#paste-css-button').addEventListener('click', async () => {
  showLoadingIndicator()
  try {
    const cssText = await navigator.clipboard.readText()
    const styleSheet = createStylesheetFromText(cssText)
    displayResults(styleSheet, cssText)
  } catch (error) {
    alert('Failed to parse CSS from your clipboard');
  }
  hideLoadingIndicator()
})

function createStylesheetFromText(cssText) {
  const styleSheet = new CSSStyleSheet()
  styleSheet.replaceSync(cssText)
  return styleSheet;
}
async function fetchAndCreateStylesheet(url) {
  try {
    const response = await fetch(url)
    const cssText = await response.text()
    const styleSheet = new CSSStyleSheet()
    styleSheet.replaceSync(cssText)
    return [styleSheet, cssText]
  } catch (err) {
    alert('Failed to fetch CSS file')
  }
  return null
}

function displayResults(afterStyleSheet, before) {
  const minifyEnabled = document.querySelector('#minify-css-checkbox').checked
  const after = getMinifiedCSS(afterStyleSheet, minifyEnabled)

  const nestedCSSContainer = document.querySelector('#nested-css-container')
  nestedCSSContainer.removeAttribute('hidden')
  nestedCSSContainer.querySelector('#textarea-before').value = before
  nestedCSSContainer.querySelector('#textarea-after').value = after
  // show character length comparison - assuming UTF-8 encoding - 1 character = 1 byte
  // Can get encoding from Content-Type header in charset parameter
  nestedCSSContainer.querySelector('.before .file-weight').textContent = `Original: ${textToKBs(before)} KBs`
  nestedCSSContainer.querySelector('.after .file-weight').textContent = `With Nesting: ${textToKBs(after)} KBs`

  const copyButton = nestedCSSContainer.querySelector('.after #copy-button')
  copyButton.addEventListener('click', () => {
    const copied = copyToClipboard(after)
    const copyButtonIcon = copyButton.querySelector('md-icon')
    const currentIcon = copyButtonIcon.innerText

    if (copied) {
      copyButtonIcon.innerText = 'done'
      copyButton.style.setProperty('--md-fab-container-color', '#4CAF50')
      copyButton.style.setProperty('--md-fab-icon-color', '#ffffff')
    } else {
      copyButtonIcon.innerText = 'error'
      copyButton.style.setProperty('--md-fab-container-color', '#F44336')
      copyButton.style.setProperty('--md-fab-icon-color', '#ffffff')
    }
    
    setTimeout(() => {
      copyButtonIcon.innerText = currentIcon
      copyButton.style.removeProperty('--md-fab-container-color')
      copyButton.style.removeProperty('--md-fab-icon-color')
    }, 3000);
  })
}

document.querySelector("md-switch[aria-controls='browser-support-embed']").addEventListener('change', e => {
  document.querySelector('#browser-support-embed').style.display = e.target.selected ? 'block' : 'none'
})

async function showLoadingIndicator() {
  await yieldToMain();
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