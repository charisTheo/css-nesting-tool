const NON_SELECTOR_RULE_TYPES = {
  CSSPropertyRule: { identifier: '@property', valueKey: 'cssText' },
  CSSMediaRule: { identifier: '@media', valueKey: 'conditionText' },
  CSSFontFaceRule: { identifier: '', valueKey: 'cssText' },
  CSSPageRule: { identifier: '@page', valueKey: 'cssText' },
  CSSKeyframesRule: { identifier: '@keyframes', valueKey: 'name' },
  CSSKeyframeRule: { identifier: '', valueKey: 'cssText' }, // keyframe rule i.e. from { transform: scale(1) }
  CSSNamespaceRule: { identifier: '', valueKey: 'cssText' },
  CSSSupportsRule: { identifier: '@supports', valueKey: 'conditionText' },
}

function mapDescendantSelectorsToCssText(rule, currentLevel, convertColorsEnabled) {
  if (rule === null) {
    return
  }

  if (!rule.selectorText) {
  // It's a @rule
    switch (rule.constructor.name) {
      case 'CSSContainerRule': {
        const ruleName = `@container ${rule.containerQuery}`
        currentLevel[ruleName] = {parentType: rule.constructor.name}
        Array.from(rule.cssRules).map(r => {
          mapDescendantSelectorsToCssText(r, currentLevel[ruleName], convertColorsEnabled);
        })
        break
      }

      case 'CSSScopeRule': {
        const ruleName = `@scope (${rule.start})${rule.end ? ` to (${rule.end})` : ''}`
        currentLevel[ruleName] = {parentType: rule.constructor.name}
        Array.from(rule.cssRules).map(r => {
          mapDescendantSelectorsToCssText(r, currentLevel[ruleName], convertColorsEnabled);
        })
        break
      }

      case 'CSSLayerStatementRule': {
        currentLevel['cssText'] = (currentLevel['cssText'] || '') + rule.cssText.replaceAll(', ', ',')
        break
      }

      case 'CSSLayerBlockRule': {
        const ruleName = `@layer ${rule.name}`
        currentLevel[ruleName] = {parentType: rule.constructor.name}
        Array.from(rule.cssRules).map(r => {
          mapDescendantSelectorsToCssText(r, currentLevel[ruleName], convertColorsEnabled);
        })
        break
      }

      case 'CSSFontFaceRule':
      case 'CSSPageRule':
      case 'CSSPropertyRule':
      case 'CSSKeyframesRule':
      case 'CSSKeyframeRule':
      case 'CSSNamespaceRule':
      case 'CSSMediaRule':
      case 'CSSSupportsRule': {
        const { identifier, valueKey } = NON_SELECTOR_RULE_TYPES[rule.constructor.name]

        if (identifier === '@page') {
          currentLevel[identifier] = {cssText: rule[valueKey].replaceAll(/(@page|{|})/g, '').trim()}
        } else if (identifier === '@property') {
          currentLevel[`${identifier} ${rule.name}`] = {cssText: rule[valueKey].replaceAll(/(@property.*{|})/g, '').trim()}
        } else {
          currentLevel[`${identifier} ${rule[valueKey]}`] = {
            ...(currentLevel[`${identifier} ${rule[valueKey]}`] || {}),
            parentType: rule.constructor.name
          }
        }

        if (rule.cssRules) {
          Array.from(rule.cssRules).map(r => {
            mapDescendantSelectorsToCssText(r, currentLevel[`${identifier} ${rule[valueKey]}`], convertColorsEnabled);
          })
        }
        break
      }

      default: {
        console.warn('⚠️ | Uncaptured CSS rule | This rule will be omitted from the CSS output!', rule);
        break
      }
    }
    return
  }

  const cssText = convertColorsEnabled ? shortenColors(rule.style.cssText) : rule.style.cssText

  // if multiple selectors, do not break them up i.e. `.s1, .s2 {}`
  if (rule.selectorText.indexOf(',') !== -1) {
    const ruleTopSelector = rule.selectorText;
    currentLevel[ruleTopSelector] = {
      ...(currentLevel[ruleTopSelector] || {}),
      cssText: (currentLevel[ruleTopSelector]?.cssText || '') + cssText
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
      cssText: (currentLevel[ruleTopSelector]?.cssText || '') + cssText
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
        cssText: (currentPartLevel[part].cssText || '') + cssText
      }
    }
    if (i !== 0) {
      currentPartLevel[part].chain = true
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
      constructor: { name: rule.constructor.name },
      style: { cssText: rule.style.cssText },
      selectorText: selectors.map(s => s.trim()).join(' ')
    }, 
    currentLevel[ruleTopSelector] || currentPartLevel,
    convertColorsEnabled
  );
}

function cssTextsFromSelectorsMap(object, isNested = false, minifyEnabled) {
  const keys = Object.keys(object)
  
  return keys.map(k => {
    if (k === 'parentType' || k === 'chain') {
      return ''
    }

    var skipNesting = false
    // If current selector doesn't have any CSS rules AND is not a media query or keyframes declaration
    if (!object[k]?.cssText && k.trim().indexOf('@') !== 0 && !object.chain) {
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
      const hasSiblings = Object.keys((object || {})).filter(_ => _ !== 'chain' && _ !== 'cssText').length >= 1

      return (hasSiblings ? '' : '{') + (
        minifyEnabled 
          // remove spaces, 0's from floats and px from 0px 
          // i.e. `color: rgba(255, 228, 253, 0.5)` -> `color:rgba(255,228,253,.5)`
          // i.e. margin: 20px 0px; -> margin:20px 0;
          ? cssTextString.replaceAll(/((?<=(\d,|:|;))\s)|(0(?=\.))|((?<=[^-0-9]0)px)/g, '')
          // add new line characters between declarations
          : '\n' + cssTextString.replaceAll('; ', `;\n${isNested ? '    ' : '  '}`) + '\n'
      ) + (hasSiblings ? '' : '}')

    } else {
      const hasSingleNestedChild = Object.keys((object[k] || {})).filter(_ => _ !== 'chain' && _ !== 'cssText').length <= 1
      const cssTextString = cssTextsFromSelectorsMap(object[k], !hasSingleNestedChild, minifyEnabled).join('');
      
      const nestCharacter = addNestCharacter(!object[k].chain, (isNested || !!object.cssText), minifyEnabled)
      const selector = addSelector(k, minifyEnabled)

      const hasSingleChildOrCssTextOnly = Object.keys((object[k] || {})).filter(_ => _ !== 'chain').length <= 1
      const openingBrackets = openBrackets(hasSingleChildOrCssTextOnly, isNested, minifyEnabled)
      const closingBrackets = closeBrackets(hasSingleChildOrCssTextOnly, isNested, minifyEnabled)

      return `${nestCharacter}${selector}${openingBrackets}${cssTextString}${closingBrackets}`
    }
  })
}

/**
 * 
 * @param {StyleSheet} styleSheet
 * @param {Boolean} minifyEnabled
 * @param {Boolean} convertColorsEnabled
 * @returns 
 */
export function getNestedCSS(styleSheet, minifyEnabled, convertColorsEnabled) {
  const SELECTORS_MAP = {}

  const rules = Array.from(styleSheet?.cssRules || styleSheet?.rules)
  // console.log('🪲 | rules:', rules)
  
  mergeCommonCssTextRules(rules)

  rules.forEach(rule => mapDescendantSelectorsToCssText(rule, SELECTORS_MAP, convertColorsEnabled))

  const cssTextStringArray = cssTextsFromSelectorsMap(SELECTORS_MAP, false, minifyEnabled)
  const cssTextString = cssTextStringArray.join('')
  // console.log('🪲 | cssTextString:', cssTextString)
  return minifyEnabled ? removeSpacesAndSemiColons(cssTextString) : cssTextString
}

/**
 * Finds and merges rules with common CSS by mutating a given array
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

function addNestCharacter(isChild, isChainedAndNested, minifyEnabled) {
  const nestChar = isChild ? ' ' : isChainedAndNested ? '&' : ''
  return minifyEnabled || !isChainedAndNested ? nestChar : `\n\n  ${nestChar}`
}
function addSelector(selector, minifyEnabled) {
  // remove space from ': ' in '@media screen and (min-width: 768px)'
  // and space from commas in selectors i.e. '.s1, .s2'
  return minifyEnabled 
    ? selector.replaceAll(/(?<=(:|,))\s/g, '')
    : selector
}
function openBrackets(hasSingleChildOrCssTextOnly, isNested, minifyEnabled) {
  if (hasSingleChildOrCssTextOnly) {
    return ''
  }
  return minifyEnabled ? '{' : `{\n  ${isNested ? '  ' : ''}`
}
function closeBrackets(hasSingleChildOrCssTextOnly, isNested, minifyEnabled) {
  if (hasSingleChildOrCssTextOnly) {
    return ''
  }
  return minifyEnabled ? '}' : `\n${isNested ? '  ' : ''}}\n`
}

/**
 * Removes extra characters:
 * 1. ; followed by a }
 * 2. space preceded by a }
 * 3. space preceded by a ;
 * @param {String} cssText 
 * @returns {String}
 */
function removeSpacesAndSemiColons(cssText) {
  return cssText.replaceAll(/;(?=\})|(?<=\})\s|(?<=;)\s/g, '').trim();
}

/**
 * ? https://colorjs.io/notebook/
 * Shorten RGB colors to Hexadecimal
 * ? Supported color spaces: https://colorjs.io/docs/spaces
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
 * @returns {Number} - float in KBs i.e. 12.34
 */
export function textToKBs(text) {
  return (text.length / 1024).toFixed(2)
}

/**
 * Adds a comma after each thousand to improve readability of large numbers
 * @param {Number} number i.e 1686.55
 * @returns {String} i.e. 1,686.55
 */
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
 * * becomes: ['div', '.class', '#id', ':hover', '[disabled]', ':not([disabled])']
 * * i.e. `> :not(figcaption)` stays as it is
 * * i.e. `> button[type='submit']:disabled` becomes ["> button[type='submit']", ':disabled']
 * * i.e. `div:not(.class)` becomes ['div', ':not(.class)']
 * @param {String} selectorText
 * @returns {Array<String>}
 */
function splitSimpleSelector(selectorText) {
  return selectorText.split(/(?=(?<!\(|>\s)(:?:|\[]|\.|#))/g).filter(_ => _ && ![':', '::', '#', '.'].find(c => c === _));
}