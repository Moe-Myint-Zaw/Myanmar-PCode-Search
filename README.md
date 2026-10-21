# Myanmar PCode Search Mobile

An offline-first Android and iOS app for finding Myanmar administrative places by English or Myanmar name, PCode, postal code, or device location. Place search and GPS-to-place matching use the on-device dataset; map coverage is managed separately.

## Architecture

- **Place data:** A versioned SQLite database is bundled with the app and provisioned automatically. Indexed local queries handle place, PCode, postal, hierarchy, and nearby searches.
- **Maps:** MapLibre displays the configurable map style. Offline areas are separate, explicitly requested map packs; having the place database does not imply offline map coverage.
- **Location:** Expo Location is accessed in context. Nearby matching uses the local spatial grid and database; coordinates are not uploaded for normal lookup.
- **App and navigation:** Expo Router screens compose typed React Native components and call database, search, location, and map services.

## Technology

Expo SDK 57 · React Native · TypeScript · Expo Router · `expo-sqlite` · MapLibre React Native · `expo-location` · Jest · Python dataset tools

## Requirements and setup

- Node.js 22 or newer and npm
- Python 3 for dataset-generation and validation scripts
- Android Studio and Android SDK for Android development
- Xcode and CocoaPods for iOS development

Install JavaScript dependencies and check the Expo environment:

```sh
npm ci
npx expo-doctor
```

The checked-in `android/` and `ios/` projects include the native configuration required by MapLibre. Expo Go does not include this native module. Build and install the app on a configured device or emulator with:

```sh
npm run android
# or
npm run ios
```

To build a standalone Android release APK locally:

```sh
cd android
./gradlew :app:assembleRelease
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`. Release signing currently uses the local Android debug signing configuration; configure a private release key before distributing through an app store.

## Development workflow

Start Metro for an installed development build:

```sh
npm start
```

Run checks before submitting changes:

```sh
npm run lint
npm test
npm run typecheck
python3 -m unittest discover -s scripts -p 'test_*.py'
```

For a fresh or changed native configuration, run `npx expo prebuild --no-install` and rebuild the native app. MapLibre changes require a new native build, not only a Metro restart.

### Dataset and provider configuration

The prepared compact dataset (`data/pcode-compact.json`) and bundled database (`assets/database/myanmar_pcode.db`) are required app inputs and are intentionally versioned. Rebuild the database with `npm run build:database`, or regenerate the dataset and database with `npm run build:dataset`. Source provenance and required input files are documented in [`data/README.md`](data/README.md); do not fabricate place records or coordinates.

The default map style is OpenFreeMap Liberty. `EXPO_PUBLIC_MAP_STYLE_URL` replaces the style; offline downloads for a custom provider remain disabled unless its terms and attribution have been reviewed and `EXPO_PUBLIC_MAP_OFFLINE_DOWNLOADS_ENABLED=true` is set. Setting that flag to `false` disables downloads. A trusted HTTPS dataset update endpoint can optionally be set with `EXPO_PUBLIC_DATASET_UPDATE_URL`.

Place details can request an online driving route from the device's current GPS location. The default routing endpoint is the public OSRM demo server, which has no availability guarantee; configure `EXPO_PUBLIC_ROUTING_API_URL` to use a managed OSRM-compatible routing service. Route requests share the requested origin and destination coordinates with that endpoint and are unavailable offline.

## Directory structure

```text
app/                    Expo Router screens and navigation
assets/database/        Bundled SQLite place database
assets/images/, fonts/  App artwork and fonts
android/, ios/          Native Android and iOS projects
data/                   Prepared dataset and source-data documentation
scripts/                Dataset preparation, database build, and tests
src/components/         Reusable React Native UI
src/contexts/           App and database contexts
src/db/                 SQLite schema, repositories, initialization, updates
src/map/                MapLibre configuration and offline-pack services
src/services/            Search, location, and network services
src/spatial/             Grid lookup and distance calculations
src/types/, utils/       Shared domain types and utilities
```

## Product specification

[`PROJECT_SPEC_MOBILE.md`](PROJECT_SPEC_MOBILE.md) defines data semantics, search ranking, offline behavior, map-provider requirements, and acceptance criteria. Physical-device GPS and offline map/storage testing remains necessary; emulator success alone does not establish device acceptance.
