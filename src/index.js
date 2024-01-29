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

import { getNestedCSS, splitThousandsWithComma, textToKBs } from './utils.js'

const EXAMPLE_CSS_FILE_URL = 'https://www.gstatic.com/devrel-devsite/prod/v2969aa5c356a1994c35b6b6f94f2c6fc8c28faf9af75d026e0b265867da17793/web/css/app.css'

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
    console.log('🪲 | paste-css-button | error:', error);
    alert('Failed to parse CSS from your clipboard');
  }
  hideLoadingIndicator()
})

document.querySelector('#upload-file-button').addEventListener('click', async () => {
  document.querySelector('#upload-file-input').click();
})
document.querySelector('#upload-file-input').addEventListener('change', async e => {
  showLoadingIndicator()
  try {
    const file = document.querySelector('#upload-file-input').files?.[0];
    if (file) {
      const cssText = await file.text()
      const styleSheet = createStylesheetFromText(cssText)
      displayResults(styleSheet, cssText)
    }
  } catch (error) {
    console.log('🪲 | upload-file-input | error:', error);
    alert('Failed to parse the CSS file');
  }
  hideLoadingIndicator()
})

// ! prefixes (-webkit-) are not included in created StyleSheet
// Example from google.com https://www.gstatic.com/og/_/ss/k=og.qtm.nko5ezWrvR8.L.W.O/m=qcwid/excm=qaaw,qadd,qaid,qein,qhaw,qhba,qhbr,qhch,qhga,qhid,qhin/d=1/ed=1/ct=zgms/rs=AA2YrTvccU9RE0PSvvoW1mAlAc12i4Ml8w
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
    console.log('🪲 | fetchAndCreateStylesheet | err:', err);
    alert('Failed to fetch CSS file')
  }
  return null
}

function displayResults(afterStyleSheet, before) {
  const minifyEnabled = document.querySelector('#minify-css-checkbox').checked
  const convertColorsEnabled = document.querySelector('#convert-colors-checkbox').checked
  const after = getNestedCSS(afterStyleSheet, minifyEnabled, convertColorsEnabled)

  const nestedCSSContainer = document.querySelector('#nested-css-container')
  nestedCSSContainer.removeAttribute('hidden')
  nestedCSSContainer.querySelector('#textarea-before').value = before
  nestedCSSContainer.querySelector('#textarea-after').value = after
  // show character length comparison - assuming UTF-8 encoding - 1 character = 1 byte
  // Can get encoding from Content-Type header in charset parameter
  const beforeKBs = textToKBs(before)
  const afterKBs = textToKBs(after)
  const percentageChange = ((afterKBs - beforeKBs) * 100 / beforeKBs).toFixed(2)
  const changePolarity = percentageChange > 0 ? '+' : ''
  const changePolarityColor = Number(percentageChange) === 0 ? '' : percentageChange < 0 ? 'green-text' : 'red-text'
  const percentageChangeString = `<span class="${changePolarityColor}">${changePolarity}${percentageChange}%</span>`
  const beforeHtmlString = `Original: ${splitThousandsWithComma(beforeKBs)} KBs`
  const afterHtmlString = `Nested: ${splitThousandsWithComma(afterKBs)} KBs (${percentageChangeString})`
  nestedCSSContainer.querySelector('.before .file-weight').innerHTML = beforeHtmlString
  nestedCSSContainer.querySelector('.after .file-weight').innerHTML = afterHtmlString

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

  // If scrolled to top of the page, scroll to result
  setTimeout(() => {
    if (window.scrollY < 50) {
      nestedCSSContainer.scrollIntoView({ behavior: 'smooth' })
    }
  }, 0);
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