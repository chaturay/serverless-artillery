# NPM PUBLISHING

## Command Check

Please verify the following before publishing to NPM

[ ] All commands working:
* deploy
* invoke
* remove
* kill
* script
* configure
* upgrade

## When Lambda Assets are Modified

If the function assets were modified as part of this change
make sure that upgrading has been implemented for this version
of the assets.

[ ] In the `versioning` directory, copy the existing assets under
    the current version into `assets`. (See `versioning/0.0.0/assets`
    for an example.) 
    
[ ] Update the current version number in `.slsart` in `lib/lambda`
    according to semantic versioning rules.
    
[ ] Create a new directory under `versioning` that corresponds to the
    now updated version number in `.slsart`. (See `versioning/0.0.1/assets`
    for an example.)
    
[ ] Implement upgrade from previous version to current version in 
    `upgrade.js`. (See `versioning/0.0.1/upgrade.js` for an example.)
    
[ ] Implement unit test cases for the `upgrade` in `tests/versioning/X.X.X/upgrade.spec.js`

[ ] Implement integration test cases for version-to-version upgrades
    in `tests/integration/versioning/Y.Y.Y-X.X.X/upgrade.js`

## How to Publish

[ ] Merge changes to `master` branch

[ ] Using the `master` branch, run the `npm run publish` command. Follow the instructions
    on screen to change to the version number. This will tag the local git repository with that version.
    
[ ] Once publishing is complete, perform a `git --tags push` which will push the tags to the server.
