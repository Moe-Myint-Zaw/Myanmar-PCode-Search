---
name: myanmar-pcode-mobile-starter
description: Build and maintain the Myanmar PCode Search mobile app with clean, typed React Native code and its Expo, SQLite, GPS, spatial search, and MapLibre offline-map architecture. Use for mobile app implementation, UI, navigation, data, offline behavior, or project setup in this workspace.
---

# Myanmar PCode Search Mobile Developer

Use this skill when implementing or maintaining the standalone Android/iOS mobile project described by `PROJECT_SPEC_MOBILE.md`. The specification is the source of truth for product behavior and data semantics. This skill provides implementation and quality standards; it does not authorize changing the specification's requirements.

## Before You Start

1. Read `PROJECT_SPEC_MOBILE.md` completely, then inspect the current repository, its package manager, scripts, existing implementation, and any applicable repository instructions. Preserve existing work and conventions. Do not overwrite or regenerate an existing app without understanding it.
2. Check whether an Expo-specific skill is available in the current environment and follow it alongside this skill. Do not assume one is installed.
3. Recheck current official documentation before selecting SDK versions, native packages, config plugins, or APIs. Use the Expo SDK version selector and package references rather than copying a version number from this skill. Use `npx expo install` for Expo-compatible package versions, then run the available Expo diagnostics (including `npx expo-doctor`).
4. Treat MapLibre React Native as a native dependency: verify its current Expo config/prebuild and development-build requirements, New Architecture support, platform requirements, and offline API behavior before integrating it. Do not assume Expo Go contains the required native module.
5. Make a small, testable change at a time. After each substantive change, run the narrowest relevant check before expanding scope. Do not build anything when the user asks only for plans, skills, or documentation.

## Architecture

Keep the app's two offline systems independent:

- **PCode engine:** bundled/versioned dataset in persistent `expo-sqlite`; all ordinary place, PCode, postal, hierarchy, and nearby lookups are local.
- **Map engine:** MapLibre map resources managed as explicit offline packs. Map-pack availability is not equivalent to PCode database availability.
- **UI/navigation:** React Native and Expo Router; screens call services, services call repositories or platform adapters. Keep SQL and business rules out of screen components.
- **Device location:** `expo-location`, requested only after an explicit user action. GPS-to-place matching is local; do not send coordinates to a server for normal nearby lookup.

Use the folder organization in the specification as a guide (`app/`, `src/db/`, `src/services/`, `src/spatial/`, `src/map/`, `src/types/`, `src/utils/`, `scripts/`). Adapt it to existing repository structure rather than mechanically adding empty folders.

## Mobile Developer Standards

- Write TypeScript that is explicit at module boundaries. Preserve the repository's TypeScript settings, model domain data and service results with useful types, and avoid `any`, unchecked casts, and duplicated representations of the same data.
- Keep route screens focused on composition and user interaction. Put database access, business rules, location operations, and offline-pack lifecycle logic behind small reusable services or components, following established project patterns.
- Keep state close to where it is used. Use SQLite for place data, React state/context for UI state, and the offline map service for pack state; do not add global state or dependencies without a concrete need.
- Give every asynchronous user flow intentional loading, success, empty, and error states. Prevent duplicate actions where appropriate, keep errors structured at service boundaries, and provide a clear recovery or alternate path such as manual search when GPS permission is denied.
- Build a polished, simple interface with clear information hierarchy, consistent spacing and typography, restrained purposeful color, and layouts that adapt to small and large screens. Prefer native React Native controls and platform-appropriate navigation and interactions; avoid adding visual patterns that conflict with existing app conventions.
- Make controls accessible: use semantic roles and labels, maintain readable contrast and text scaling, provide adequate touch targets, and do not communicate important states by color alone. Keep bilingual content and long Myanmar/English place names legible without clipping.
- Reuse existing design and implementation patterns before introducing abstractions. Keep components small and reusable when they serve multiple screens or clarify a complex view; do not split code solely to satisfy arbitrary size targets.

## Non-Negotiable Behavior

- Preserve the specified `places` fields, PCode meanings, source provenance, and search ranking: exact PCode, exact postal code, exact names, prefixes, substrings, township matches, then coordinate-bearing places.
- SQLite is the source for local place queries. Do not copy the full dataset into React state. Use parameterized SQL and indexes for frequent lookups.
- Nearby lookup must use the spatial grid and distance calculation, not a full-table scan per GPS request.
- Preserve `coord_source` values (`mimu`, `boundary`, `villages`, `town`). Never label derived/approximate coordinates as surveyed or silently invent a place, PCode, or coordinate.
- Install dataset updates atomically. Validate version, schema, record count, uniqueness, indexes, and checksum before replacing the working database; retain the last valid database on failure.
- Download map areas only after explicit user action. Support pack listing, progress/error state, cancellation and pause/resume where supported, deletion, updates/invalidation, storage visibility, and offline coverage feedback. Do not download all of Myanmar or assume previously viewed tiles are sufficient.
- Select a map/style provider whose license permits the intended offline downloads; honor attribution and usage limits. Keep provider configuration replaceable and PCode search independent of it.
- Normal GPS lookup must not use reverse geocoding. Online landmark geocoding is an explicit feature; clearly report when unavailable offline. Parse supported coordinate URLs locally.
- Request permissions in context. If location is denied, retain manual coordinate entry and place search.
- Distinguish app status accurately: online/offline, database ready/missing, and map coverage available/unavailable are separate states.
- Return structured service errors and present bilingual user-facing messages where practical.

## Implementation Order

Follow the development phases in `PROJECT_SPEC_MOBILE.md`, adapting to existing work:

1. Inspect the source-data pipeline and establish the Expo Router/TypeScript app and native build path.
2. Generate, validate, bundle, install, and version the compact SQLite dataset.
3. Implement normalization, indexed search, exact lookups, hierarchy queries, and the specified ranking.
4. Implement coordinate parsing, Haversine distance, spatial grid, and local nearby search; then connect `expo-location` permissions and GPS.
5. Integrate MapLibre for online display and markers only after verifying provider policy and native build compatibility.
6. Add explicit offline-pack management and coverage/error states; validate after app restart with networking disabled.
7. Add safe dataset update/rollback behavior and complete device-focused QA.

Do not couple MapLibre initialization or missing map packs to database readiness. Do not let a database failure crash the map screen.

## Tests and Completion

For each behavior, add or extend tests in the repository's existing framework. At minimum cover normalization, ranking, exact PCode and postal lookup, coordinate parsing, Haversine distance, spatial grid candidate selection, coordinate-source handling, and dataset metadata validation. Test SQLite persistence and representative queries against the generated database.

For offline acceptance, disable networking and verify name/PCode/postal search, GPS-to-nearest-place, place details, and a previously downloaded map pack. Restart the app during this validation. Verify that panning beyond pack coverage produces a clear unavailable state without crashing or repeatedly requesting tiles. Use physical Android and iOS devices for GPS, native map, and storage behavior; simulators alone are insufficient.

A feature is complete only when its applicable spec requirements are implemented, type checks and tests pass, error states are handled, offline claims have been tested offline, and the relevant acceptance criteria in the spec are met. Update documentation when behavior or setup changes.

## Current Documentation References

Checked against official documentation on 2026-10-03. These are living references, not pinned SDK versions; re-open them before implementation:

- [Expo SDK reference](https://docs.expo.dev/versions/latest/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [expo-location](https://docs.expo.dev/versions/latest/sdk/location/)
- [MapLibre React Native setup](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/)
- [MapLibre React Native documentation](https://maplibre.org/maplibre-react-native/docs/)

The current Expo SQLite reference exposes `SQLiteProvider` and `openDatabaseAsync`; the location reference documents foreground-permission and current-position APIs. Confirm exact signatures and any asset-copying, migration, and platform-specific requirements in the active SDK reference. Confirm the current MapLibre offline-pack API, listeners, resume/pause support, and Android/iOS limitations in its maintained documentation before implementing it.
