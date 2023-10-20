# [CSS Nesting tool](https://charistheo.github.io/css-nesting-tool/)

> This tools is publicly hosted here: https://charistheo.github.io/css-nesting-tool/

Shrink your CSS files and benefit from improving rendering performance and decreasing the impact on your users' data with CSS Nesting.

🎉 [CSS Nesting is part of Interop 2024](https://github.com/web-platform-tests/interop/issues/420)
📖 [Learn more about CSS Nesting](https://developer.chrome.com/articles/css-nesting/)

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

- [ ] Use [minifier](https://github.com/matthiasmullie/minify) after nesting
- [ ] Add CSS file upload button
- [ ] Add support for Container queries
- [ ] Remove nest character (&) for rules inside media queries 
  (e.g. `@media (prefers-color-scheme: light) {  & .form-select { ...`)