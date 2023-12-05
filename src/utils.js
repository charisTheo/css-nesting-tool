const NON_SELECTOR_RULE_TYPES = {
  0: { identifier: '@property', valueKey: 'cssText' },
  4: { identifier: '@media', valueKey: 'conditionText' },
  6: { identifier: '@page', valueKey: 'cssText' },
  7: { identifier: '@keyframes', valueKey: 'name' },
  8: { identifier: '', valueKey: 'cssText' },
  12: { identifier: '@supports', valueKey: 'conditionText' },
}

function mapCssTextInSelectors(rule, currentLevel) {
  if (!rule.selectorText) {
  // It's a @rule
    if (NON_SELECTOR_RULE_TYPES[rule.type]) {

      //! @container, @layer, @scope and @property rules are all of type '0'

      //? Container Queries
      if (rule instanceof CSSContainerRule) {
        const ruleName = `@container ${rule.containerQuery}`
        currentLevel[ruleName] = {parentType: rule.type}
        Array.from(rule.cssRules).map(r => {
          mapCssTextInSelectors(r, currentLevel[ruleName]);
        })
        return
      }

      //? Scope rules
      if (rule instanceof CSSScopeRule) {
        //! console.log(rule) throws an error: https://bugs.chromium.org/p/chromium/issues/detail?id=1498448
        const ruleName = `@scope (${rule.start})${rule.end ? ` to (${rule.end})` : ''}`
        currentLevel[ruleName] = {parentType: rule.type}
        Array.from(rule.cssRules).map(r => {
          mapCssTextInSelectors(r, currentLevel[ruleName]);
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
          mapCssTextInSelectors(r, currentLevel[ruleName]);
        })
        return
      }
      
      const { identifier, valueKey } = NON_SELECTOR_RULE_TYPES[rule.type]

      if (identifier === '@page') {
        currentLevel[identifier] = {cssText: rule[valueKey].replaceAll(/(@page|{|})/g, '').trim()}
      } else if (identifier === '@property') {
        currentLevel[`${identifier} ${rule.name}`] = {cssText: rule[valueKey].replaceAll(/(@property.*{|})/g, '').trim()}
      } else {
        currentLevel[`${identifier} ${rule[valueKey]}`] = {parentType: rule.type}
      }

      if (rule.cssRules) {
        Array.from(rule.cssRules).map(r => {
          mapCssTextInSelectors(r, currentLevel[`${identifier} ${rule[valueKey]}`]);
        })
      }
    } else {
      console.warn('⚠️ | Uncaptured CSS rule | This rule will be omitted from the CSS output!', rule);
    }
    return
  }

  // * splitting between '> <selector>', '+', ':<selector>' and space characters
  // if input is minified CSS still works because it is firstly parsed into a StyleSheet that adds spaces by default
  const selectors = rule.selectorText.split(/(?<!>)\s|(?=:|>\s)/).filter(s => s);
  // i.e. currentLevel[parent] = {[child]: cssText}
  const ruleTopSelector = selectors[0];

  // no nesting needed as there is not second element in current selector
  if (ruleTopSelector === rule.selectorText) {
    currentLevel[ruleTopSelector] = {
      ...(currentLevel[ruleTopSelector] || {}),
      cssText: (currentLevel[ruleTopSelector]?.cssText || '') + shortenColors(rule.style.cssText)
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

function cssTextMapToString(object, isNested = false, minifyEnabled, relaxedNesting) {
  const keys = Object.keys(object)
  
  return keys.map(k => {
    if (k === 'parentType') {
      return ''
    }

    var skipNesting = false
    // If current selector doesn't have any CSS rules AND is not a media query or keyframes declaration
    if (!object[k]?.cssText && k.trim().indexOf('@') !== 0) {
      // * if there is no cssText key in this set of keys, do not nest
      // i.e. turn `& li { & a { ... } }` into `& li a { ... }`
      skipNesting = true
    }

    if (object[k]?.cssText === '' && Object.keys(object[k] || {}).length < 2) {
      // * skip empty CSS rules with no declarations
      return ''
    }

    // skip nest character (&) for all @ CSS rules, i.e.  `@media (min-height: 768px) { & .form-select {...`
    if (NON_SELECTOR_RULE_TYPES[object?.parentType]?.identifier) {
      isNested = false
    }

    if (k === 'cssText') {
      return (
        minifyEnabled 
          // remove spaces, 0's from floats and px from 0px 
          // i.e. `color: rgba(255, 228, 253, 0.5)` -> `color:rgba(255,228,253,.5)`
          // i.e. margin: 20px 0px; -> margin:20px 0;
          ? object[k].trim().replaceAll(/((?<=(\d,|:|;))\s)|(0(?=\.))|((?<=[^-0-9]0)px)/g, '')
          // add new line characters between declarations
          : object[k].trim().replaceAll('; ', `;\n${isNested ? '    ' : '  '}`)
      )

    } else {
      const isPseudoElement = k.startsWith(':') // for &:hover to be equal to li:hover when nested

      return `${addNestCharacter(isNested, minifyEnabled, k.startsWith('>') || relaxedNesting, isPseudoElement)}${addSelector(k, minifyEnabled, skipNesting)}${skipNesting ? '' : openBrackets(isNested, minifyEnabled)}${cssTextMapToString(object[k], !skipNesting, minifyEnabled, relaxedNesting).join('')}${skipNesting ? '' : closeBrackets(isNested, minifyEnabled)}`.replaceAll(';}', '}')
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

  rules.forEach(rule => mapCssTextInSelectors(rule, TOP_SELECTORS_MAP));

  const cssTextString = cssTextMapToString(TOP_SELECTORS_MAP, false, minifyEnabled, relaxedNesting).join('');
  // console.log('🪲 | cssTextString:', cssTextString);
  return cssTextString;
}

function addNestCharacter(isNested, minifyEnabled, relaxedNesting, isPseudoElement) {
  const nestChar = isPseudoElement
    ? '&'
    : (relaxedNesting ? '' : '& ')

  return isNested
    ? (minifyEnabled ? nestChar : `\n\n  ${nestChar}`)
    : ''
}
function addSelector(selector, minifyEnabled, isNested) {
  // remove space from ': ' in '@media screen and (min-width: 768px)'
  return (minifyEnabled 
    ? selector.replaceAll(/(?<=:)\s/g, '')
    : selector + ' ')
    + (isNested ? ' ' : '')
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
  const numberString = String(number);
  const [integerPart, decimalPart] = numberString.split('.');
  const integerPartWithCommas = integerPart.replace(/(?<!\B)\d{3}(?=\B)/g, ',');
  const numberWithCommas = `${integerPartWithCommas}.${decimalPart}`;
  return numberWithCommas;
}