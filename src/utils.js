function mapCssTextInSelectors(rule, currentLevel) {
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

function cssTextMapToString(object, isNested = false) {
  const keys = Object.keys(object)
  
  return keys.map(k => {
    var skipNesting = false
    if (!object[k]?.cssText) {
      // * if there is no cssText key in this set of keys, do not nest
      // i.e. turn `& li { & a { ... } }` into `& li a { ... }`
      skipNesting = true
    }

    if (k === 'cssText') {
      return object[k].trim() + '\n';
    } else {
      return `${isNested ? '&' : ''} ${k}${skipNesting ? '' : '{\n'}${cssTextMapToString(object[k], !skipNesting).join('')}${skipNesting ? '' : '}\n'}`
    }
  })
}

export function getMinifiedCSS(styleSheet) {
  const TOP_SELECTORS_MAP = {};

  // const styleSheet = document.styleSheets[0];
  const rules = Array.from(styleSheet?.cssRules || styleSheet?.rules);
  console.log('🪲 | rules:', rules);

  rules.forEach(rule => mapCssTextInSelectors(rule, TOP_SELECTORS_MAP));

  const cssTextString = cssTextMapToString(TOP_SELECTORS_MAP).join('');
  console.log('🪲 | cssTextString:', cssTextString);
  return cssTextString;
}