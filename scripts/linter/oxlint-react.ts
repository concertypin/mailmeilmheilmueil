// oxlint React plugin rules (native Rust implementation — not ESLint plugin)
// See https://oxc.rs/docs/guide/usage/linter/plugins for the built-in plugin list.
// Rules use `react/*` namespace; do not use `react-hooks/*` — they are under `react/`.

import { defineConfig } from "oxlint";

export default defineConfig({
    $schema: "../../node_modules/oxlint/configuration_schema.json",
    rules: {
        "react/jsx-key": "error",
        "react/jsx-no-comment-textnodes": "error",
        "react/jsx-no-duplicate-props": "error",
        "react/jsx-no-undef": "error",
        "react/no-children-prop": "error",
        "react/no-unknown-property": "error",
        "react/rules-of-hooks": "error",
        "react/exhaustive-deps": "error",
        // Automatic JSX runtime — React does not need to be in scope
        "react/react-in-jsx-scope": "off",
    },
    categories: {},
});
