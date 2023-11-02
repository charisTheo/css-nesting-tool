# [CSS Nesting tool](https://charistheo.github.io/css-nesting-tool/)

> This tools is publicly hosted here: https://charistheo.github.io/css-nesting-tool/

Shrink your CSS files and benefit from improving rendering performance and decreasing the impact on your users' data with CSS Nesting.

🎉 [CSS Nesting is part of Interop 2024](https://github.com/web-platform-tests/interop/issues/420)
📖 [Learn more about CSS Nesting](https://developer.chrome.com/articles/css-nesting/)

![CSS nesting tool demo screenshot](./demo-screenshot.png)

## Development

### Run locally

1. Clone repo

```sh
git clone https://github.com/charisTheo/css-nesting-tool.git && cd css-nesting-tool
```

2. Install dependencies

```sh
npm i
```

3. Run dev server

```sh
npm start
```

### Build and run production

[All steps above](#run-locally) and:

```sh
npm run build && npm run serve
```

### TODOs

- [ ] [Bug] Prefixes i.e. `-webkit-` are not included in JS-created `StyleSheet`

```js
var cssText = '.some-class { -webkit-border-radius: 4px; border-radius: 4px; color: #fff; }'
var styleSheet = new CSSStyleSheet()
await styleSheet.replace(cssText)
styleSheet
```

- [ ] [Improvement] Nest pseudo elements/selectors, i.e. `:hover`, `:before`
- [ ] [Improvement] Nest direct child selectors i.e. `div > a`
- [ ] [Improvement] Add CSS file upload button