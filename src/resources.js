const lernaPublish = require('@lerna/publish')
const latestVersion = require('latest-version')

export class ExternalResources {
    getPackageLatestVersion(name, { registryUrl } = {}) {
        return latestVersion(name, registryUrl ? { registryUrl } : {})
    }

    publish(options) {
        return lernaPublish(options)
    }
}