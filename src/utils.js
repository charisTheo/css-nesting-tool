const NON_SELECTOR_RULE_TYPES = {
  0: { identifier: '@property', valueKey: 'cssText' },
  4: { identifier: '@media', valueKey: 'conditionText' },
  6: { identifier: '@page', valueKey: 'cssText' },
  7: { identifier: '@keyframes', valueKey: 'name' },
  8: { identifier: '', valueKey: 'cssText' },
  12: { identifier: '@supports', valueKey: 'conditionText' },
}

function mapDescendantSelectorsToCssText(rule, currentLevel) {
  if (rule === null) {
    return
  }

  if (!rule.selectorText) {
  // It's a @rule
    if (NON_SELECTOR_RULE_TYPES[rule.type]) {

      //! @container, @layer, @scope and @property rules are all of type '0'

      //? Container Queries
      if (rule instanceof CSSContainerRule) {
        const ruleName = `@container ${rule.containerQuery}`
        currentLevel[ruleName] = {parentType: rule.type}
        Array.from(rule.cssRules).map(r => {
          mapDescendantSelectorsToCssText(r, currentLevel[ruleName]);
        })
        return
      }

      //? Scope rules
      if (rule instanceof CSSScopeRule) {
        //! console.log(rule) throws an error: https://bugs.chromium.org/p/chromium/issues/detail?id=1498448
        const ruleName = `@scope (${rule.start})${rule.end ? ` to (${rule.end})` : ''}`
        currentLevel[ruleName] = {parentType: rule.type}
        Array.from(rule.cssRules).map(r => {
          mapDescendantSelectorsToCssText(r, currentLevel[ruleName]);
        })
        return
      }
      
      //? Layer order
      if (rule instanceof CSSLayerStatementRule) {
        currentLevel['cssText'] = (currentLevel['cssText'] || '') + rule.cssText.replaceAll(', ', ',')
        return
      }

      //? Layer block rule
      if (rule instanceof CSSLayerBlockRule) {
        const ruleName = `@layer ${rule.name}`
        currentLevel[ruleName] = {parentType: rule.type}
        Array.from(rule.cssRules).map(r => {
          mapDescendantSelectorsToCssText(r, currentLevel[ruleName]);
        })
        return
      }
      
      const { identifier, valueKey } = NON_SELECTOR_RULE_TYPES[rule.type]

      if (identifier === '@page') {
        currentLevel[identifier] = {cssText: rule[valueKey].replaceAll(/(@page|{|})/g, '').trim()}
      } else if (identifier === '@property') {
        currentLevel[`${identifier} ${rule.name}`] = {cssText: rule[valueKey].replaceAll(/(@property.*{|})/g, '').trim()}
      } else {
        currentLevel[`${identifier} ${rule[valueKey]}`] = {
          ...(currentLevel[`${identifier} ${rule[valueKey]}`] || {}),
          parentType: rule.type
        }
      }

      if (rule.cssRules) {
        Array.from(rule.cssRules).map(r => {
          mapDescendantSelectorsToCssText(r, currentLevel[`${identifier} ${rule[valueKey]}`]);
        })
      }
    } else {
      console.warn('⚠️ | Uncaptured CSS rule | This rule will be omitted from the CSS output!', rule);
    }
    return
  }

  // if multiple selectors, do not break them up i.e. `.s1, .s2 {}`
  if (rule.selectorText.indexOf(',') !== -1) {
    const ruleTopSelector = rule.selectorText;
    currentLevel[ruleTopSelector] = {
      ...(currentLevel[ruleTopSelector] || {}),
      cssText: (currentLevel[ruleTopSelector]?.cssText || '') + shortenColors(rule.style.cssText)
    }
    return
  }

  const selectors = splitSelectorByDescendantCombinators(rule.selectorText)
  // i.e. currentLevel[parent] = {[child]: cssText}
  const ruleTopSelector = selectors[0].trim();
  const isLastDescendant = ruleTopSelector === rule.selectorText

  // no nesting needed as there is not second element in current selector
  if (isLastDescendant && !splitSimpleSelector(ruleTopSelector).length) {
    currentLevel[ruleTopSelector] = {
      ...(currentLevel[ruleTopSelector] || {}),
      cssText: (currentLevel[ruleTopSelector]?.cssText || '') + shortenColors(rule.style.cssText)
    }
    return;
  }
  
  const parts = splitSimpleSelector(ruleTopSelector)
  const lastIndex = parts.length - 1
  
  var currentPartLevel = currentLevel

  for (var i = 0; i <= lastIndex; i++) {
    const isLastSelector = i === lastIndex
    const part = parts[i]
    if (!currentPartLevel[part]) {
      currentPartLevel[part] = {}
    }

    if (isLastDescendant && isLastSelector) {
      currentPartLevel[part] = {
        ...currentPartLevel[part],
        cssText: (currentPartLevel[part].cssText || '') + shortenColors(rule.style.cssText)
      }
    }
    if (i !== 0) {
      currentPartLevel.chain = true
    }

    currentPartLevel = currentPartLevel[part]
  }

  if (isLastDescendant) {
    return
  }

  selectors.shift();

  mapDescendantSelectorsToCssText(
    {
      ...rule,
      style: {
        cssText: rule.style.cssText,
      },
      selectorText: selectors.map(s => s.trim()).join(' ')
    }, 
    currentLevel[ruleTopSelector] || currentPartLevel
  );
}

function cssTextMapToString(object, isNested = false, minifyEnabled, relaxedNesting) {
  const keys = Object.keys(object)
  
  return keys.map(k => {
    if (k === 'parentType' || k === 'chain') {
      return ''
    }

    var skipNesting = false
    // If current selector doesn't have any CSS rules AND is not a media query or keyframes declaration
    if (!object[k]?.cssText && k.trim().indexOf('@') !== 0 && !object[k].chain) {
      // * if there is no cssText key in this set of keys, do not nest
      // i.e. turn `li { & a { ... } }` into `li a { ... }`
      skipNesting = true
    }

    if (object[k]?.cssText === '' && Object.keys(object[k] || {}).filter(_ => _ !== 'chain').length < 2) {
      // * skip empty CSS rules with no declarations
      return ''
    }

    // skip nest character (&) for all @ CSS rules, i.e.  `@media (min-height: 768px) { & .form-select {...`
    if (NON_SELECTOR_RULE_TYPES[object?.parentType]?.identifier) {
      isNested = false
    }

    if (k === 'cssText') {
      const cssTextString = object[k].trim()

      return (
        minifyEnabled 
          // remove spaces, 0's from floats and px from 0px 
          // i.e. `color: rgba(255, 228, 253, 0.5)` -> `color:rgba(255,228,253,.5)`
          // i.e. margin: 20px 0px; -> margin:20px 0;
          ? cssTextString.replaceAll(/((?<=(\d,|:|;))\s)|(0(?=\.))|((?<=[^-0-9]0)px)/g, '')
          // add new line characters between declarations
          : cssTextString.replaceAll('; ', `;\n${isNested ? '    ' : '  '}`)
      )

    } else {
      const cssTextString = cssTextMapToString(
        object[k],
        Boolean(Object.keys((object[k] || {})).filter(_ => _ !== 'chain').length),
        minifyEnabled,
        relaxedNesting
      ).join('');
      
      // do not add the '&' character in these cases
      relaxedNesting = relaxedNesting || k.startsWith('>')

      return `${addNestCharacter(isNested, minifyEnabled, relaxedNesting, object.chain)}${addSelector(k, minifyEnabled, skipNesting)}${skipNesting ? '' : openBrackets(isNested, minifyEnabled)}${cssTextString}${skipNesting ? '' : closeBrackets(isNested, minifyEnabled)}`.replaceAll(';}', '}')
    }
  })
}

/**
 * 
 * @param {StyleSheet} styleSheet
 * @param {Boolean} minifyEnabled
 * @param {Boolean} relaxedNesting
 * @returns 
 */
export function getMinifiedCSS(styleSheet, minifyEnabled, relaxedNesting) {
  const TOP_SELECTORS_MAP = {};

  const rules = Array.from(styleSheet?.cssRules || styleSheet?.rules);
  // console.log('🪲 | rules:', rules);
  
  mergeCommonCssTextRules(rules)

  rules.forEach(rule => mapDescendantSelectorsToCssText(rule, TOP_SELECTORS_MAP));

  const cssTextString = cssTextMapToString(TOP_SELECTORS_MAP, false, minifyEnabled, relaxedNesting).join('');
  // console.log('🪲 | cssTextString:', cssTextString);
  return cssTextString;
}

/**
 * Finds and merges rules with common CSS by updating the array supplied as an argument
 * @param {Array} rules 
 */
function mergeCommonCssTextRules(rules) {
  const COMMON_CSS_RULES_MAP = {}
  // * find and save selectors with common cssText
  rules.forEach((rule, index) => {
    if (!rule?.style?.cssText || !rule?.selectorText) {
      return
    }

    // save indexes of the `rules` array
    COMMON_CSS_RULES_MAP[rule.style.cssText] = [
      ...(COMMON_CSS_RULES_MAP[rule.style.cssText] || []),
      index
    ]
  })
  
  // * merge selectors with common cssText
  Object.keys(COMMON_CSS_RULES_MAP).forEach(k => {
    const rulesIndexes = COMMON_CSS_RULES_MAP[k]
    if (rulesIndexes.length < 2) {
      return
    }

    // pick one index to merge every other rule into that
    const markerIndex = rulesIndexes.shift();
    rulesIndexes.forEach(i => {
      rules[markerIndex].selectorText += `, ${rules[i].selectorText}`
      // need to keep merged rules in the array so that indexes can still work
      // mark merged rules as null and will be ignored in following operations
      rules[i] = null
    })
  })
}

function addNestCharacter(isNested, minifyEnabled, relaxedNesting, chain) {
  const nestChar = chain ? '&' : (relaxedNesting ? ' ' : '& ')

  return isNested
    ? (minifyEnabled ? nestChar : `\n\n  ${nestChar}`)
    : ''
}
function addSelector(selector, minifyEnabled) {
  // remove space from ': ' in '@media screen and (min-width: 768px)'
  // and space from commas in selectors i.e. '.s1, .s2'
  return (minifyEnabled 
    ? selector.replaceAll(/(?<=(:|,))\s/g, '')
    : selector + ' ')
}
function openBrackets(isNested, minifyEnabled) {
  return minifyEnabled ? '{' : `{\n  ${isNested ? '  ' : ''}`
}
function closeBrackets(isNested, minifyEnabled) {
  return minifyEnabled ? '}' : `\n${isNested ? '  ' : ''}}\n`
}

/**
 * ? https://colorjs.io/notebook/
 * Shorten RGB colors to Hexadecimal
 * ? Supported color spaces: https://colorjs.io/docs/spaces
 * 
 * @param {String} cssText
 * @returns 
 */
function shortenColors(cssText) {
  const matches = cssText.matchAll(/(rgba?|color|hsl|hsv|hwb|(ok)?lch|(ok)?lab)\((?!var\().*?\)/g) || []
  for (const match of matches) {
    try {
      const c = match[0]
      const color = new Color(c)
      const hex = color.toString({ format: 'hex' });
      cssText = cssText.replace(c, hex)
    } catch (err) {
      console.log('🪲 | shortenColors | err:', err);
    }
  }
  return cssText
}

/**
 * @param {String} text - i.e. 'abababababababa'
 * @returns {String} - '15' (KBs)
 */
export function textToKBs(text) {
  return splitThousandsWithComma((text.length / 1024).toFixed(2))
}

export function splitThousandsWithComma(number) {
  return Number(number).toLocaleString('en-US')
}


/**
 * * splitting between '> <selector>' and space characters
 * ? CSS input is parsed into a StyleSheet before this step so every selector has spaces where possible (unminified)
 * ? i.e. we have `.s1 > .s2` instead of `.s1>.s2`
 * @param {String} selectorText 
 * @returns {Array<String>}
 */
function splitSelectorByDescendantCombinators(selectorText) {
  return selectorText.split(/(?<!>)\s|(?=>\s)/).filter(s => s);
}

/**
 * This function should only run after selectors have been split by space
 * * i.e. `div.class#id:hover[disabled]:not([disabled])`
 * * becomes: `['div', '.class', '#id', ':hover', '[disabled]', ':not([disabled])']`
 * @param {String} selectorText
 * @returns {Array<String>}
 */
function splitSimpleSelector(selectorText) {
  return selectorText.split(/(?=(?<!\():?:|\[]|\.|#)/g).filter(_ => _ && _ !== ':');
}