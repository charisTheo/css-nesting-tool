function mapCssTextInSelectors(rule, currentLevel) {
  if (!rule.selectorText) {
    // keyframes and media queries
    // TODO add keyframes and media queries to the final CSS text
    return
  }
  // * in minified CSS, splitting with space still works!
  const selectors = rule.selectorText.split(/>|\s|\+/).filter(s => s);
  const ruleTopSelector = selectors[0];

  // no nesting needed as there is not second element in current selector
  if (ruleTopSelector === rule.selectorText) {
    currentLevel[ruleTopSelector] = {
      ...(currentLevel[ruleTopSelector] || {}),
      cssText: (currentLevel[ruleTopSelector]?.cssText || '') + rule.style.cssText
    }
    return;
  }

  selectors.shift();
  if (!currentLevel[ruleTopSelector]) {
    currentLevel[ruleTopSelector] = {}
  }
  mapCssTextInSelectors(
    {
      ...rule,
      style: {
        cssText: rule.style.cssText,
      },
      selectorText: selectors.join(' ')
    }, 
    currentLevel[ruleTopSelector]
  );
}

function cssTextMapToString(object, isNested = false, minifyEnabled) {
  const keys = Object.keys(object)
  
  return keys.map(k => {
    var skipNesting = false
    if (!object[k]?.cssText) {
      // * if there is no cssText key in this set of keys, do not nest
      // i.e. turn `& li { & a { ... } }` into `& li a { ... }`
      skipNesting = true
    }

    if (k === 'cssText') {
      return (minifyEnabled ? object[k].trim() : object[k].trim().replaceAll('; ', ';\n'));
    } else {
      return `${addNestCharacter(isNested, minifyEnabled)}${addSelector(k, minifyEnabled)}${skipNesting ? '' : openBrackets(minifyEnabled)}${cssTextMapToString(object[k], !skipNesting, minifyEnabled).join('')}${skipNesting ? '' : closeBrackets(minifyEnabled)}`
    }
  })
}

/**
 * 
 * @param {StyleSheet} styleSheet
 * @param {Boolean} minifyEnabled
 * @returns 
 */
export function getMinifiedCSS(styleSheet, minifyEnabled) {
  const TOP_SELECTORS_MAP = {};

  // const styleSheet = document.styleSheets[0];
  const rules = Array.from(styleSheet?.cssRules || styleSheet?.rules);
  // console.log('🪲 | rules:', rules);

  rules.forEach(rule => mapCssTextInSelectors(rule, TOP_SELECTORS_MAP));

  const cssTextString = cssTextMapToString(TOP_SELECTORS_MAP, false, minifyEnabled).join('');
  // console.log('🪲 | cssTextString:', cssTextString);
  return cssTextString;
}

function addNestCharacter(isNested, minifyEnabled) {
  return isNested ? (minifyEnabled ? '& ' : '\n\n  & ') : ''
}
function addSelector(selector, minifyEnabled) {
  return selector + (minifyEnabled ? '' : ' ')
}
function openBrackets(minifyEnabled) {
  return minifyEnabled ? '{' : '{\n  '
}
function closeBrackets(minifyEnabled) {
  return minifyEnabled ? '}' : '\n}\n\n'
}

/**
 * @param {String} text - i.e. 'abababababababa'
 * @returns {String} - '15'
 */
export function textToKBs(text) {
  return splitThousandsWithComma((text.length / 1024).toFixed(2))
}

export function splitThousandsWithComma(number) {
  const numberString = String(number);
  const [integerPart, decimalPart] = numberString.split('.');
  const integerPartWithCommas = integerPart.replace(/(?<!\B)\d{3}(?=\B)/g, ',');
  const numberWithCommas = `${integerPartWithCommas}.${decimalPart}`;
  return numberWithCommas;
}