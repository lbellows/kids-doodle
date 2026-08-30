# App-level F-Droid metadata

`com.kidsdoodle.app.yml` is the app description the self-hosted F-Droid repo
publishes: licence, categories, source and issue links, and the current version.

It is **not** a build recipe. `fdroid update` takes the title, description,
icon, screenshots and changelogs from `fastlane/metadata/android/<locale>/`, but
it reads licence, categories and the link back to source from
`metadata/<appid>.yml`. Without this file KidsDoodle publishes as licence
"Unknown" in a catch-all category with no source link.

[`lbellows/fdroid`](https://github.com/lbellows/fdroid) clones this repository
on each publish and derives `metadata/com.kidsdoodle.app.yml` from this file
(`scripts/app_metadata.py`); its `apps.json` names this path. Renaming or
deleting it breaks the listing, so change both together.

`AllowedAPKSigningKeys` deliberately does not live here — the publishing repo
supplies it from its own `apps.json`.

