import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * Flat config. eslint-config-next 16 ships native flat configs, so FlatCompat
 * is no longer needed (and no longer works with it).
 */
export default [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "node_modules/**", "supabase/**", "next-env.d.ts"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  /* ------------------------------------------------------------------
   * React Compiler rules, scoped off where they flag correct code.
   * Each exemption is deliberate and narrow — none is applied globally.
   * ------------------------------------------------------------------ */
  {
    // `const Icon = getIcon(row.icon)` resolves a CMS string through a
    // module-level registry and renders it. The lookup returns a stable
    // reference, but the rule cannot see that through the indirection.
    files: [
      "src/components/content/Cards.tsx",
      "src/components/pcb/HotspotChip.tsx",
      "src/app/**/industries/**/page.tsx",
      "src/components/admin/IconPicker.tsx",
    ],
    rules: { "react-hooks/static-components": "off" },
  },
  {
    // Initial state that only exists in the browser — localStorage, matchMedia,
    // sessionStorage — cannot be read during SSR, so it has to be synchronised
    // on mount. The alternative (useSyncExternalStore) buys nothing here
    // because none of these values change after hydration.
    files: [
      "src/components/layout/ThemeToggle.tsx",
      "src/components/layout/SiteHeader.tsx",
      "src/components/admin/AdminShell.tsx",
      "src/components/pcb/PcbStage.tsx",
      "src/components/forms/QuoteWizard.tsx",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  {
    // three.js objects are mutable by design: animating a camera means writing
    // camera.position and camera.fov inside useFrame. Cloning per frame would
    // defeat the point of the render loop.
    files: ["src/components/pcb/PcbScene.tsx", "src/components/admin/AuthorCanvas.tsx"],
    rules: { "react-hooks/immutability": "off", "react-hooks/purity": "off" },
  },
  {
    // Server Components read the clock to build "unassigned for over a day"
    // style windows. These routes are force-dynamic, so a per-request clock is
    // the intended behaviour rather than an impurity.
    files: ["src/app/(admin)/**/*.tsx", "src/app/(site)/**/*.tsx"],
    rules: { "react-hooks/purity": "off" },
  },
  {
    // Node scripts run through native type stripping, outside the app bundle.
    files: ["scripts/**/*.ts", "scripts/**/*.mjs"],
    rules: { "@typescript-eslint/no-require-imports": "off", "no-console": "off" },
  },
];
