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

### Further optimisations

- [ ] Combine multiple property declarations

    ```css
    .selector-1 {
      padding-left: 20px; 
      padding-right: 10px;
      border-color: black;
      border-width: 2px;
      border-style: solid;
    }

    /* Merge into */
    .selector-1 {
      padding: unset 10px unset 20px;
      border: 2px solid black;
    }
    ```

- [ ] Merge multiple selectors with the same properties

    ```css
    .selector-1 {
      padding: 20px;
      margin: 20px;
    }
    .selector-2 {
      padding: 20px;
      margin: 20px;
    }

    /* Merge into */
    .selector-1, .selector-2 {
      padding: 20px;
      margin: 20px;
    }
    ```

    - Save each cssText in a secondary map that stores it as a key and its value are the keys to the map which is stored
    - Each time before adding a new cssText to the primary map, check if current cssText exists in primary map
    - If the primary map keys change, need to update the secondary map too

- [ ] Merge selectors with same parent

    ```css
    .selector {
      padding: 10px;
    }
    .selector.additional {
      padding: 20px;
    }
    .selector.additional .child {
      margin: 20px;
    }

    /* Merge into */
    .selector {
      padding: 10px;

      &.additional {
        padding: 20px;

        & .child {
          margin: 20px;
        }
      }
    }
    ```
