# What If `node_modules` is Owned By Root?

You might be reading this because during installation you saw:
```
npm ERR! code EACCES
```

We hope you're just proactive!  :D :tada:

/sigh

`root` ownership of `node_modules` indicates a failure somewhere along your delivery chain.  Having your `node_modules` folder owned by root [is an](https://news.ycombinator.com/item?id=16438889) [anti-pattern](https://givan.se/do-not-sudo-npm/).  You should fix that!  (but don't be ashamed - we've been there) 

Being opinionated aside, we want to be helpful and you're not alone.

If you are using Docker, check out [Docker Installation](README.md#docker-installation).

Otherwise, the maintainers of NPM have [provided a guide](https://docs.npmjs.com/getting-started/fixing-npm-permissions) on how to resolve or avoid a circumstance where this is the case.  We strongly recommend following that guidance and even more so, understanding the reason why root ownership of node_modules is broadly rejected by the community.

That said, we understand that sometimes you have your context defined for you and while you will advocate for change you have to deal in the meantime.  Read on!

The reason this matters in the first place is that during the post-installation step we run npm install transitively in `~/lib/lambda` to aquire function dependencies.  This means that installing using sudo would let us run our arbitrary code with `#all-the-rights!`.  Do you really trust us?  That much?  Wow.

Really?  In that case you can make the risky choice (there are better options) to use `--unsafe-perm=true` during installation to allow root privileges to propogate to [our "postinstall" script](package.json).  Please approve the bank transfers.  Or... since we won't make them, please send us fungible assets via your favorite service.

**If you're smarter than that**, you have the option to use the far more safe `--ignore-scripts` and follow up your installation by running `npm i` in that directory for us (thank you!).  The latter approach has the downside of potentially breaking the installation of `serverless-artillery`'s dependencies which we haven't tested to work this way and which may change in the future anyway to contain postinstall scripts.
