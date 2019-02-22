# Versioning Module

Provides a controlled means of upgrading the function assets for developers
who've invested time in customizing their project by unpacking those assets
using the `configure` command.

The upgrade capability is made accessible to the user via the `upgrade` 
command, run in the developer's own function asset project directory 
(her *local assets*.)

SA CLI will use the `upgradeAvailable()` function to check the local assets
version to see if an upgrade is available for the current version. If one
is available, the `upgradeService()` function is used to actually perform
the upgrade.

## Local Assets Versions

This feature introduces the `.slsart` hidden YAML configuration file.
Currently it contains a single string value `version`. This config file
is updated whenever the assets are upgraded and should always be set to
latest version once upgrade is complete.

The initial version of SA did not provide a `.slsart` configuration, so
in the case this file is not found in the developers project, version
"0.0.0" will be assumed.

## Upgrade Plugins

Each version of the local assets has a corresponding plugin which provides
the version-specific information needed to upgrade the users project from
one version to the next. They are located at `versioning/X.X.X/upgrade.js`
where `X.X.X` is the version which will be upgraded from.

Each of the plugins present this basic interface:

```JS
{
  nextVersion: 'X.X.X',             // Provides the next version of function assets or null.
  fileManifest: () => [],           // Array containing the list of files expected for this version.
  fileContents: assetFile => '',    // Contents of the asset file for this version.
  projectDependencies: () => {},    // Object describing the dependencies found in the package.json.
  serviceDefinitionSchema: () => {}         // JSON Schema validating a minimal acceptable service definition.
  serviceDefinitionConflictSchema: () => {} // JSON Schema detecting conflicting changes to service definition.
  upgradeServiceDefinition: (config) => ''  // Takes existing YAML service definition and upgrades it.
}
```

## Upgrade Process

### Check Availability

When the user issues the `upgrade` command, SA first checks to see if an 
upgrade is available by calling `upgradeAvailable()`. This function will
probe for the `.slsart` config file to determine the current version of
the local assets.

Using that current version, it loads the upgrade plugin
appropriate for that version. If the plugin's `nextVersion` is not null
then `upgradeAvailable()` returns `true`.

### Load Current and Next Upgrade Plugins

If a new version is available, the SA CLI code will call the `upgradeService()`
function to perform the upgrade. This function will walk the upgrade versions
one-by-one validating the local assets and upgrading them to the next version.

Before performing the upgrade, the `node_modules` and `package-lock.json`
files are removed. Once the upgrade is complete, `npm install` is run to
replace them with the updated versions.

Once the current version is determined and the current version plugin is
loaded, the `nextVersion` is used to load the nextVersion plugin. These two
plugins provided the central versioning implementation to upgrade the project
using the following steps:

1. Service has all the expected files
1. `package.json` has expected dependencies
1. `serverless.yml` still contains minimum expected configuration
1. `serverless.yml` has no additions conflicting with new version
1. Copies reference version of configured assets into `original-assets.?.?.?`
1. Backup existing project files into `backup` directory
1. Update dependencies in `package.json`
1. Transform `serverless.yml` service definition to new version
1. Update `.slsart` config file with new version

Once the updated `.slsart` configuration is written with the updated version,
the next version plugin becomes the current version plugin and the upgrade
cycle continues until `nextVersion` is `null`.
