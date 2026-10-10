# Myanmar PCode Search --- Mobile Project Specification

**Status:** Ready for Spec-Driven Development\
**Target:** Android + iOS\
**Architecture:** Expo + React Native + Expo Router + bundled SQLite + MapLibre
React Native\

------------------------------------------------------------------------

## 1. Project Overview

Myanmar PCode Search is an offline-first mobile application for finding
Myanmar administrative places by:

-   English place name
-   Myanmar place name
-   PCode
-   Postal code
-   GPS coordinates
-   Landmark/geocoding when online
-   Map interaction

The application targets field workers, survey teams, and users working
in low-connectivity or no-connectivity environments.

The mobile application defines its own data model, search ranking,
coordinate semantics, and offline architecture as a standalone product.
It is developed and maintained as a separate repository.

### Implementation status

The mobile foundation and core application workflows are implemented in
this repository. A prepared PCode dataset is available and MUST be built
into the app as a packaged SQLite database. The app MUST install that
database automatically; end users must not need to select or import a
dataset file. OpenFreeMap Liberty is the default map style; selected-area
offline packs are explicitly requested and limited to 20,000 estimated
tiles per device. Physical-device offline and map acceptance criteria
remain to be completed.

### Primary product goals

1.  Search Myanmar places by English or Myanmar name.
2.  Search by PCode and postal code.
3.  Resolve GPS coordinates to nearby administrative places.
4.  Display administrative hierarchy and coordinate source.
5.  Work fully offline for PCode/place search from the built-in dataset
    without user setup.
6.  Support explicitly downloaded offline map regions, including regions
    the user has never viewed before.
7.  Optionally install validated dataset releases when connectivity is
    available.
8.  Provide a reliable field-work experience on Android and iOS.

------------------------------------------------------------------------

# 2. Product Architecture


Offline functionality MUST be divided into two independent systems.

``` text
                    Mobile App
                        |
          +-------------+-------------+
          |                           |
      PCode Engine                Map Engine
          |                           |
       SQLite                  MapLibre Offline
          |                      Offline Packs
          |                           |
    Place Search               Map Tiles + Style
    PCode Lookup               Selected Regions
    Postal Search              Selected Zooms
    Nearby Search
          |
          +-------------+-------------+
                        |
                       GPS
                        |
                 Nearest PCode
```

## 3.1 PCode offline

The complete compact PCode dataset MUST be available locally in SQLite.

Offline PCode operations MUST NOT depend on HTTP requests.

Supported offline operations:

-   Place name search
-   PCode lookup
-   Postal code lookup
-   Nearby place lookup
-   GPS-to-place matching
-   Administrative hierarchy lookup

## 3.2 Map offline

The application MUST NOT assume that previously viewed map tiles are
sufficient.

Users MUST be able to explicitly download a map region for offline use.

Example:

``` text
Offline Maps
-------------------------
Yangon Region     420 MB
Mandalay Region   310 MB
Bago Region       280 MB

[Download Area]
```

The map download flow MUST support:

-   Region/bounding-box selection
-   Minimum zoom
-   Maximum zoom
-   Estimated download size where available
-   Download progress
-   Pause/resume where supported
-   Download cancellation
-   Existing pack listing
-   Pack deletion
-   Pack update/invalidation when online
-   Offline-only map mode
-   Custom bounding-box selection with validated minimum/maximum zooms
-   A bounded tile-count estimate and configurable per-device download ceiling

MapLibre OfflineManager supports creating, listing,
updating/invalidation, and deleting offline packs.
citeturn0search0turn0search10

------------------------------------------------------------------------

# 3. Target Users

## 3.1 End users

-   Field workers needing local geography and PCodes
-   Survey teams collecting GPS coordinates
-   Public users searching administrative areas
-   Users in low-connectivity areas
-   Users who need pre-downloaded maps during field work

# 4. Functional Scope

## 4.1 Search

The app MUST support:

-   English name search
-   Myanmar name search
-   PCode search
-   Postal code search
-   Township-assisted search
-   Type filtering:
    -   town
    -   ward
    -   village_tract
    -   village
    -   postal
    -   all

Search ranking MUST remain:

1.  Exact PCode
2.  Exact postal code
3.  Exact names
4.  Prefix matches
5.  Substring matches
6.  Township matches
7.  Places with coordinates first

Search MUST work offline.

For efficient substring matching on English and Myanmar names and
township names, and prefix matching on postal codes, the bundled SQLite
database MUST include an FTS5 trigram index over the normalized search
fields. Index maintenance MUST remain transactional with place inserts,
updates, and deletes, including validated dataset updates. Terms shorter
than three Unicode code points MUST retain substring-search behavior
using the regular SQLite predicate. The FTS index is derived data and
MUST NOT alter the specified ranking or source place fields.

------------------------------------------------------------------------

# 5. Place Detail

A place detail screen MUST display:

-   Place name in English
-   Place name in Myanmar
-   Place type
-   PCode
-   Postal code
-   State/Region
-   District
-   Township
-   Town
-   Village Tract
-   Latitude
-   Longitude
-   Coordinate source
-   Distance when computed

Coordinate source MUST be clearly displayed:

-   `mimu` --- official surveyed MIMU coordinate
-   `boundary` --- OCHA boundary centroid
-   `villages` --- village centroid-based approximation
-   `town` --- parent town fallback

Approximate coordinates MUST NOT be presented as official surveyed
coordinates.

------------------------------------------------------------------------

# 6. GPS and Nearby Search

The map MUST show and refresh a current-location pin while it is open when
the user grants foreground location permission. Opening the map is the
context for requesting that permission. The "My Location" action remains
available to retry permission or recenter the map.

Native location access MUST be handled through `expo-location`.
citeturn0search6

Flow:

``` text
User opens the map or taps "My Location"
        |
        v
Request location permission
        |
        v
Read GPS coordinates
        |
        v
Spatial grid lookup
        |
        v
Candidate places
        |
        v
Distance calculation
        |
        v
Nearest valid place
        |
        v
Place Detail
```

Nearby search MUST work without Internet.

The application MUST NOT require reverse-geocoding through Nominatim for
normal GPS-to-PCode lookup.

------------------------------------------------------------------------

# 7. Landmark / Online Geocoding

Landmark lookup may use OSM/Nominatim while online.

``` text
Landmark text
      |
      v
Online geocoding
      |
      v
lat/lng
      |
      v
Local nearby search
      |
      v
PCode result
```

If offline:

-   The app MUST clearly indicate that external landmark geocoding is
    unavailable.
-   Existing local place-name search MUST remain available.
-   The app MUST NOT silently fabricate coordinates.

Google Maps-style coordinate URLs MUST still be parsed locally when
possible.

------------------------------------------------------------------------

# 8. Map Requirements

## 8.1 Online map

MapLibre React Native MUST render the configured map style and tiles
when online.

The production map provider/style MUST be configurable and must have
licensing/usage terms appropriate for the project.

Do not use a public tile endpoint in a way that violates its usage
policy.

## 8.2 Offline map

Offline map support MUST be implemented using explicit offline packs.

An offline pack consists of the resources required to render a selected
region at selected zoom levels.

Example:

``` text
Region: Yangon
Bounds: west, south, east, north
Min Zoom: 10
Max Zoom: 16

        |
        v

MapLibre OfflineManager
        |
        v
Offline Pack
        |
        v
Local map resources
        |
        v
Offline Map
```

MapLibre's OfflineManager supports `createPack`, progress/error
listeners, `getPacks`, `deletePack`, and pack invalidation.
citeturn0search0

## 8.3 Offline map management screen

The app MUST provide:

-   Available regions
-   Download button
-   Download progress
-   Download state
-   Installed size where available
-   Update button
-   Delete button
-   Offline pack status
-   Last updated time

The Available areas list MUST include each State/Region represented in
the installed place database. Where administrative boundary polygons are
not available, derive each download bounding box from that
State/Region's coordinate-bearing places, label the bounds as
approximate, and use the default zoom range 7–13 to stay within the
per-device tile ceiling. Downloads remain explicit and are requested
individually.

States:

``` text
NOT_DOWNLOADED
QUEUED
DOWNLOADING
PAUSED
COMPLETE
FAILED
UPDATING
DELETING
```

## 8.4 Offline map behavior

When offline:

-   The map MUST use downloaded offline packs.
-   The app MUST NOT repeatedly attempt network tile requests.
-   A missing offline tile MUST NOT crash the app.
-   The UI MUST indicate when the current viewport is outside downloaded
    coverage.

MapLibre provides a network connectivity manager that can disable
network requests for the map on Android, allowing cached/offline
resources to be used. citeturn0search14

The current implementation adds a user-controlled downloaded-maps-only
switch and disables map downloads/updates when offline. It estimates
requested tiles for preset and custom bounds and enforces a 20,000-tile
per-device ceiling to protect storage. Revisit this configurable ceiling
after provider policy and real-device storage tests.

------------------------------------------------------------------------

# 9. Offline Database

## 9.1 Database technology

Use:

``` text
expo-sqlite
```

The database MUST persist across application restarts. A complete,
versioned SQLite database MUST be bundled with each app release and
provisioned into the app's writable SQLite directory automatically on
first launch. Routine place search MUST NOT depend on a user choosing,
copying, or importing a file.
citeturn0search2

Database filename:

``` text
myanmar_pcode.db
```

## 9.2 Tables

### places

``` sql
CREATE TABLE places (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  pcode TEXT NOT NULL UNIQUE,
  name_eng TEXT,
  name_mmr TEXT,
  sr_pcode TEXT,
  sr_name TEXT,
  district_pcode TEXT,
  district_name TEXT,
  tsp_pcode TEXT,
  tsp_name TEXT,
  town_pcode TEXT,
  town_name TEXT,
  vt_pcode TEXT,
  vt_name TEXT,
  lat REAL,
  lng REAL,
  coord_source TEXT,
  postal_code TEXT
);
```

The runtime schema also stores normalized search columns and a
`place_grid(cell_key, place_id)` index for nearby candidate selection.
These are derived lookup fields; the source place fields and coordinate
provenance remain unchanged.

## 9.3 Search indexes

Indexes MUST be created for:

``` text
pcode
postal_code
type
tsp_pcode
town_pcode
vt_pcode
```

Name search MUST use normalized searchable fields.

Recommended additional columns:

``` text
name_eng_normalized
name_mmr_normalized
tsp_name_normalized
```

## 9.4 Spatial index

The existing spatial-grid concept MUST be preserved.

The implementation MUST avoid scanning all places for every GPS query.

Flow:

``` text
lat/lng
  |
  v
grid cell
  |
  v
neighbor cells
  |
  v
candidate places
  |
  v
Haversine distance
  |
  v
nearest valid place
```

------------------------------------------------------------------------

# 10. Built-in Database Provisioning

The application MUST ship with a prebuilt SQLite database generated
from the repository's validated compact dataset. The packaged database
is the app's built-in place-data feature, not an optional user download.
The JSON dataset remains a build input and MUST NOT be loaded into
React state at runtime.

Build and first-launch flow:

``` text
Prepared source dataset
   |
   v
Build and validate SQLite artifact
   |
   v
Package database asset in app binary
   |
App first launch
   |
   v
Provision bundled database into writable SQLite storage
   |
   v
Verify schema, metadata, indexes, record count, and integrity
   |
   v
Ready for offline search
```

Provisioning MUST be automatic and idempotent. An existing valid working
database MUST be retained across restarts and app upgrades. If it is
missing or invalid, the app MUST report a structured initialization
error and attempt recovery from the bundled database without exposing a
file-picker workflow. The build pipeline MUST validate metadata,
SHA-256, record count, unique PCodes, coordinate ranges and provenance,
schema, indexes, and SQLite integrity before producing the bundled
artifact. A failed asset validation or provisioning operation MUST NOT
be shown as a ready database.

Dataset build inputs and their provenance MUST be documented in
`data/README.md`. The generated SQLite asset is a release artifact;
rebuilding it MUST be deterministic for the same inputs and schema.

The app MUST expose:

-   Dataset version
-   Dataset source
-   Record count
-   Installed date
-   Last update date
-   Whether the active dataset came from the bundled release or a
    validated update

------------------------------------------------------------------------

# 11. Optional Dataset Updates

The built-in dataset MUST be usable without network access or update
configuration. If a trusted update endpoint is configured by the
application release, the app MAY offer an explicit online update flow:

``` text
Online
  |
  v
Check remote metadata
  |
  v
Compare dataset version
  |
  +-- same --> no action
  |
  +-- newer --> download update
                   |
                   v
                validate
                   |
                   v
                replace/update DB
                   |
                   v
                update metadata
```

Updates MUST be optional and MUST NOT be required to make the built-in
dataset ready. The update MUST be atomic.

A failed update MUST NOT destroy the currently working database.

The app MUST retain the previous valid dataset until the new dataset
passes validation. End users MUST NOT need to provide a URL or select a
local dataset file to install or use the built-in dataset.

------------------------------------------------------------------------

# 12. Data Sources

Preserve the existing project data sources:

-   MIMU PCode release 9.7
-   Myanmar Postal Code data
-   COD-AB centroid data from OCHA
-   OSM/Nominatim for online geocoding and landmarks

Source-derived coordinate semantics MUST remain unchanged.

The mobile repository SHALL maintain its own data preparation and
database build pipeline:

``` text
Raw source data
   |
   v
Data preparation / validation
   |
   v
Compact dataset validation
   |
   v
Prebuilt SQLite generator and integrity checks
   |
   v
Packaged myanmar_pcode.db asset
```

The source data remains the source of truth; mobile SQLite is a runtime
artifact.

The prepared dataset is build-time input; do not seed production search
with illustrative or fabricated rows. The SQLite asset MUST be generated
from this input and bundled with the app, not created by an end-user
import flow.

------------------------------------------------------------------------

# 13. Application Navigation

Use Expo Router. The current implementation groups persistent Places,
Nearby, and Map tabs, with detail and management screens on the
navigation stack.

Recommended routes:

``` text
app/
├── _layout.tsx
├── (tabs)/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── nearby.tsx
│   └── map.tsx
├── search.tsx
├── landmark.tsx
├── place/
│   └── [pcode].tsx
├── offline/
│   └── maps.tsx
├── settings.tsx
└── about.tsx
```

------------------------------------------------------------------------

# 14. Recommended Folder Structure

``` text
.
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── search.tsx
│   ├── map.tsx
│   ├── gps.tsx
│   ├── settings.tsx
│   ├── about.tsx
│   ├── place/
│   │   └── [pcode].tsx
│   └── offline/
│       ├── index.tsx
│       └── maps.tsx
│
├── src/
│   ├── components/
│   │   ├── SearchBar.tsx
│   │   ├── SearchResults.tsx
│   │   ├── PlaceCard.tsx
│   │   ├── PlaceDetail.tsx
│   │   ├── MapView.tsx
│   │   ├── OfflineMapCard.tsx
│   │   └── DownloadProgress.tsx
│   │
│   ├── db/
│   │   ├── database.ts
│   │   ├── schema.ts
│   │   ├── migrations.ts
│   │   ├── placeQueries.ts
│   │   └── bundledDatabase.ts
│   │
│   ├── services/
│   │   ├── searchService.ts
│   │   ├── nearbyService.ts
│   │   ├── locationService.ts
│   │   ├── geocodingService.ts
│   │   ├── datasetUpdateService.ts
│   │   └── offlineMapService.ts
│   │
│   ├── spatial/
│   │   ├── gridIndex.ts
│   │   └── distance.ts
│   │
│   ├── map/
│   │   ├── mapConfig.ts
│   │   ├── offlinePacks.ts
│   │   └── mapProvider.ts
│   │
│   ├── types/
│   │   ├── pcode.ts
│   │   └── map.ts
│   │
│   ├── utils/
│   │   ├── normalize.ts
│   │   └── validation.ts
│   │
│   └── constants/
│       ├── app.ts
│       └── dataset.ts
│
├── assets/
├── assets/
│   └── database/
│       └── myanmar_pcode.db
├── data/
│   └── pcode-compact.json
├── scripts/
│   └── build_compact_dataset.py
├── app.json
├── eas.json
├── package.json
├── tsconfig.json
└── PROJECT_SPEC.md
```

------------------------------------------------------------------------

# 15. State Management

The app SHOULD avoid unnecessary global state.

Recommended separation:

``` text
Local DB state
    -> SQLite queries

UI state
    -> React state/context

Offline map state
    -> OfflineMapService + MapLibre OfflineManager
```

Do not duplicate the complete PCode dataset into React state.

SQLite MUST remain the source for local place queries.

------------------------------------------------------------------------

# 16. UI Requirements

## 16.1 Home

Home screen MUST provide:

-   Search input
-   Search type filter
-   Current location button
-   Map button
-   Offline status indicator
-   Dataset status
-   Quick access to downloaded offline maps

## 16.2 Search result

Each result SHOULD display:

``` text
Myanmar name
English name
Type
PCode
Postal code
Township
Distance if available
```

## 16.3 Place detail

Must provide:

-   Administrative hierarchy
-   PCode
-   Postal code
-   Coordinates
-   Coordinate source
-   Distance
-   Open on map
-   Copy coordinates
-   Copy PCode

## 16.4 Offline status

The UI MUST distinguish:

``` text
Online
Offline
PCode database ready
PCode database missing
Map offline coverage available
Map offline coverage unavailable
```

Do not represent "offline database ready" as "entire app is fully
offline".

## 16.5 Safe areas and keyboard input

Screens with text inputs MUST respect device safe areas and remain
scrollable when the on-screen keyboard is open. Focused fields, entered
text, and their relevant submit actions MUST remain accessible above the
keyboard. Android MUST use a resizing soft-input layout; iOS MUST apply
keyboard avoidance without obscuring form content.

------------------------------------------------------------------------

# 17. Permissions

The application MUST request permissions only when needed.

Required potential permissions:

-   Location
-   File/document access as required by the platform
-   Network access

Location permission flow:

``` text
User opens the map or requests GPS
      |
      v
Explain purpose
      |
      v
Request permission
      |
      +-- granted --> read location
      |
      +-- denied --> show manual coordinate/search option
```

The app MUST continue to support manual coordinate entry when location
permission is denied.

Location updates MUST stop when the map screen is no longer active.

------------------------------------------------------------------------

# 18. Error Handling

Every service MUST return structured errors.

Examples:

``` text
LOCATION_PERMISSION_DENIED
LOCATION_UNAVAILABLE
GPS_TIMEOUT
DATABASE_NOT_READY
DATABASE_CORRUPTED
DATASET_UPDATE_FAILED
OFFLINE_PACK_DOWNLOAD_FAILED
OFFLINE_PACK_NOT_FOUND
GEOCODING_UNAVAILABLE
INVALID_COORDINATES
```

Errors shown to users MUST be bilingual where practical.

------------------------------------------------------------------------

# 19. Performance Requirements

## Search

Target:

``` text
Typical local search < 200 ms
```

for normal devices after database initialization.

## Nearby

Spatial indexing MUST be used.

The implementation MUST NOT perform a full-table scan for every GPS
lookup.

## Database

SQLite queries MUST use prepared/parameterized statements.

Indexes MUST be used for frequent lookup fields.

------------------------------------------------------------------------

# 20. Offline Map Storage Requirements

The implementation MUST protect device storage.

Requirements:

1.  Never download all Myanmar map tiles automatically.
2.  Require explicit user action to download an area.
3.  Allow the user to delete downloaded areas.
4.  Display download progress.
5.  Display or estimate storage usage.
6.  Prevent duplicate downloads where an equivalent offline pack already
    exists.
7.  Allow updating an existing pack.
8.  Support configurable zoom ranges.
9.  Fail gracefully when device storage is insufficient.
10. Keep map data separate from PCode database.

Recommended initial defaults:

``` text
Default minimum zoom: 10
Default maximum zoom: 16
```

These values MUST be configurable and SHOULD be adjusted after
real-device testing.

------------------------------------------------------------------------

# 21. Map Provider and Licensing

The project MUST NOT assume that OpenStreetMap public tile servers can
be used as an unrestricted offline tile source.

Before production:

-   Select an appropriate tile/style provider.
-   Confirm offline-download rights.
-   Confirm attribution requirements.
-   Confirm tile download/storage limits.
-   Document provider configuration in project settings.

The map provider MUST be replaceable without rewriting the PCode search
engine.

The default style is OpenFreeMap Liberty, based on OpenStreetMap data, with
MapLibre attribution enabled. OpenFreeMap states its public instance has no
map-view or request limits and publishes downloadable full-planet MBTiles.
The app MAY use its public style resources for explicitly user-requested
regional offline packs, subject to the app's 20,000 estimated-tile limit.
The public OpenStreetMap Foundation tile endpoints MUST NOT be used for
offline packs. Custom map styles MUST keep downloads disabled unless their
provider's offline-use and attribution terms are reviewed and
`EXPO_PUBLIC_MAP_OFFLINE_DOWNLOADS_ENABLED=true` is configured. Setting the
variable to `false` disables offline downloads for any provider. Online map
rendering MUST remain independent from this offline-download gate.

------------------------------------------------------------------------

# 22. Data Accuracy

The application MUST preserve the existing distinction between:

``` text
official / measured
vs.
derived / approximate
```

Rules:

-   Prefer MIMU coordinates.
-   Preserve `coord_source`.
-   Do not treat boundary centroids as surveyed coordinates.
-   Do not use approximate coordinates for workflows where false
    precision could affect the result.
-   Display coordinate source in place details.

------------------------------------------------------------------------

# 23. Dataset Versioning

Dataset metadata MUST contain at minimum:

``` json
{
  "datasetVersion": "9.7",
  "generatedAt": "ISO-8601",
  "source": "MIMU + Myanmar Postal Code + OCHA",
  "recordCount": 0,
  "schemaVersion": 1
}
```

Mobile DB metadata MUST additionally contain:

``` text
installedAt
updatedAt
databaseSchemaVersion
checksum
```

------------------------------------------------------------------------

# 24. Security and Privacy

The application MUST NOT upload GPS coordinates to the server for normal
nearby/PCode lookup.

Normal flow:

``` text
GPS
 ↓
Local SQLite
 ↓
Local spatial search
 ↓
Result
```

Online geocoding is permitted only for explicit landmark/geocoding
operations.


------------------------------------------------------------------------

# 25. Testing Strategy

## 25.1 Unit tests

Must cover:

-   Name normalization
-   Search ranking
-   PCode lookup
-   Postal lookup
-   Coordinate parsing
-   Haversine distance
-   Spatial grid
-   Coordinate-source rules
-   Dataset metadata validation

## 25.2 Database tests

Must verify:

-   Database opens successfully
-   Expected record count
-   PCode uniqueness
-   Index availability
-   Representative PCode queries
-   Myanmar name queries
-   Postal queries

## 25.3 Offline tests

The following MUST work with network disabled:

``` text
Search place
Search PCode
Search postal code
GPS -> nearest place
Place detail
Downloaded map region
```

## 25.4 Offline map tests

Test:

1.  Download region online.
2.  Close app.
3.  Disable network.
4.  Reopen app.
5.  Open downloaded region.
6.  Pan inside region.
7.  Zoom inside configured range.
8.  Confirm no network request is required.
9.  Pan outside region.
10. Confirm clear "offline coverage unavailable" behavior.

## 25.5 Device testing

Minimum target:

-   Android physical device
-   iPhone physical device

Do not rely exclusively on simulators/emulators for GPS and offline
storage validation.

------------------------------------------------------------------------

# 26. Acceptance Criteria

The mobile project is complete only when all of the following are true.

### AC-01 Search

User can search English/Myanmar names offline.

### AC-02 PCode

User can search exact PCode offline.

### AC-03 Postal

User can search full and supported partial postal codes offline.

### AC-04 GPS

User can obtain current GPS and find nearby places offline.

### AC-05 Coordinate accuracy

Coordinate source is preserved and displayed.

### AC-06 Built-in database

A fresh app installation automatically provisions the bundled PCode
database; no user file selection or import is required.

### AC-07 Dataset update

The built-in dataset remains usable offline. If online updates are
configured, a newer dataset can be installed without corrupting the
previous valid dataset.

### AC-07a Database persistence

Closing and reopening the app does not remove the provisioned PCode
database.

### AC-08 Offline map download

User can explicitly download a selected geographic region for offline
use.

### AC-09 Offline map persistence

Downloaded map packs remain available after app restart.

### AC-10 Offline map without previous viewing

A downloaded region MUST be usable offline even if the user did not
previously browse that region online.

### AC-11 Offline map deletion

User can delete a downloaded region and reclaim its storage.

### AC-14 No false offline claim

The UI distinguishes PCode offline availability from map offline
coverage.

### AC-15 Field usability

Core PCode/GPS workflows remain usable with no Internet connection.

------------------------------------------------------------------------

# 27. Development Phases

## Phase 1 --- Project bootstrap

-   Create Expo project
-   Configure Expo Router
-   Configure TypeScript
-   Configure New Architecture-compatible dependencies
-   Configure Android/iOS builds
-   Add linting and testing

Expo SDK 55+ uses React Native's New Architecture by default, so
dependencies MUST be selected for New Architecture compatibility.
citeturn0search12

## Phase 2 --- Built-in dataset and database setup

-   Use the prepared, provenance-documented source dataset
-   Generate a prebuilt SQLite database as an app asset
-   Validate schema, metadata, record count, uniqueness, indexes,
    checksum, coordinate provenance, and SQLite integrity
-   Provision the bundled database automatically on first launch
-   Verify persistence and recovery without user file selection

## Phase 3 --- Search engine

-   SQLite schema
-   Search indexes
-   Search ranking
-   PCode lookup
-   Postal lookup
-   Administrative hierarchy
-   Unit tests

## Phase 4 --- Spatial engine

-   Grid index
-   Coordinate parsing
-   Distance calculation
-   Nearby search
-   GPS service

## Phase 5 --- Map

-   MapLibre integration
-   Online map
-   Place marker
-   Current location
-   Map click -\> nearby lookup

## Phase 6 --- Offline map

-   OfflineManager
-   Region download
-   Progress
-   Pause/resume
-   Delete
-   Update
-   Offline coverage indicator
-   No-network test

## Phase 7 --- Optional dataset updates

-   Keep the built-in dataset usable without an update service
-   When configured, compare trusted remote version metadata
-   Download and validate updates explicitly
-   Atomically replace the active database only after validation
-   Preserve rollback/failure handling

## Phase 8 --- QA

-   Unit tests
-   Integration tests
-   Offline tests
-   Physical Android test
-   Physical iOS test
-   Storage stress tests
-   GPS tests

------------------------------------------------------------------------

# 28. Spec-Driven Development Rules

The implementation agent MUST follow these rules.

## Rule 1 --- Do not change core semantics

Do not change:

-   Place field meanings
-   PCode meaning
-   Coordinate-source semantics
-   Search ranking

without explicitly updating this specification.

## Rule 2 --- Offline means actually offline

A feature labeled "offline" MUST be tested with network disabled.

Do not implement offline behavior using a fallback that silently depends
on HTTP.

## Rule 3 --- Separate data from map

PCode database and map tile storage MUST remain independent.

A missing map pack MUST NOT make PCode search unavailable.

A missing PCode database MUST NOT crash the map UI.

## Rule 4 --- Prefer local computation

For:

-   PCode search
-   Postal lookup
-   GPS nearby search

use local SQLite/spatial logic.

Do not introduce an unnecessary network dependency.

## Rule 5 --- Do not silently invent data

If no local match exists:

``` text
NOT_FOUND
```

must be returned.

Do not generate approximate place names or PCodes without an explicit
documented rule.

## Rule 6 --- Preserve source provenance

Every coordinate must preserve its `coord_source`.

## Rule 7 --- Keep modules testable

Business logic MUST NOT be tightly coupled to React components.

Prefer:

``` text
UI
 ↓
Service
 ↓
Repository
 ↓
SQLite
```

instead of embedding SQL/search logic inside screen components.

------------------------------------------------------------------------

# 29. Definition of Done

A feature is DONE only when:

-   Specification requirement implemented
-   TypeScript compiles
-   Unit tests pass
-   Error states implemented
-   Offline behavior tested where applicable
-   Android tested where applicable
-   iOS tested where applicable
-   No unnecessary network dependency
-   No existing core behavior silently removed
-   Documentation updated
-   Acceptance criteria satisfied

------------------------------------------------------------------------

# 30. Initial Technical Decisions

  Area                  Decision
  --------------------- ------------------------------
  Framework             Expo
  UI                    React Native
  Navigation            Expo Router
  Language              TypeScript
  Local DB              expo-sqlite
  Map                   MapLibre React Native
  Offline map           MapLibre OfflineManager
  GPS                   expo-location
  Dataset source        Mobile-owned source-data pipeline
  Local place data      SQLite
  Initial dataset       Prebuilt SQLite asset bundled with app
  Provisioning          Automatic on first launch; no user import
  Spatial lookup        Spatial grid + distance
  Offline map storage   MapLibre offline packs
  State                 Local/service-oriented state
  Architecture          Offline-first

------------------------------------------------------------------------

# 31. Non-Goals

The following are NOT part of the initial mobile product:

-   User accounts
-   Authentication
-   Multi-user synchronization
-   GIS polygon editing
-   Admin CMS
-   Real-time collaborative editing
-   Full navigation/routing
-   Turn-by-turn directions
-   Cloud storage of user CSV files
-   Automatic download of all Myanmar map tiles

------------------------------------------------------------------------

# 32. Future Opportunities

Potential future extensions:

-   Download map by State/Region
-   Download map by District
-   Download map by Township
-   Custom bounding-box offline maps
-   Better fuzzy Myanmar-name matching
-   Transliteration matching
-   Favorite places
-   Saved field locations
-   GPS track recording
-   Survey form integration
-   Photo attachment
-   Offline field survey records
-   Export GeoJSON
-   Export GPX
-   Dataset delta updates
-   Map provider switching
-   Advanced spatial search

------------------------------------------------------------------------

# 33. Final Architecture

``` text
                         +----------------------+
                         |  Expo React Native   |
                         +----------+-----------+
                                    |
             +----------------------+----------------------+
             |                      |                      |
             v                      v                      v
        Search UI               Map UI                GPS UI
             |                      |                      |
             v                      v                      v
       SearchService          MapService          LocationService
             |                      |                      |
             v                      v                      |
       SQLite Repository     MapLibre Runtime              |
             |                      |                      |
             v                      v                      |
      Myanmar PCode DB       Offline Map Packs             |
             |                      |                      |
             +----------+-----------+----------------------+
                        |
                        v
                Spatial Grid Index
                        |
                        v
                  Nearest Place
                        |
                        v
                     PCode
```

## Core principle

``` text
PCode data is built into the app and local.
GPS matching is local.
Map regions are explicitly downloaded.
Online services are enhancements, not dependencies.
```

The mobile application is considered genuinely offline-first only when
the core PCode/GPS workflows and explicitly downloaded map regions
continue to work after network access is completely disabled.
