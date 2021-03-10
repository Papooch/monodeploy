import { promises as fs } from 'fs'
import path from 'path'

import logging from '@monodeploy/logging'
import type {
    ChangesetSchema,
    MonodeployConfiguration,
    YarnContext,
} from '@monodeploy/types'

const MARKER = '<!-- MONODEPLOY:BELOW -->'

const prependChangelogFile = async (
    config: MonodeployConfiguration,
    context: YarnContext,
    changeset: ChangesetSchema,
): Promise<void> => {
    if (!config.changelogFilename) return

    const changelogFilename = path.resolve(config.cwd, config.changelogFilename)

    let changelogContents: string[] = []
    try {
        changelogContents = (
            await fs.readFile(changelogFilename, { encoding: 'utf-8' })
        ).split('\n')
    } catch (err) {
        logging.error(
            `[Changelog] Unable to read changelog contents at ${changelogFilename}`,
            { report: context.report },
        )
        throw err
    }

    const changelogOffset = changelogContents.findIndex(
        value => value.trim() === MARKER,
    )
    if (changelogOffset === -1) {
        logging.error(`[Changelog] Missing changelog marker: '${MARKER}'`, {
            report: context.report,
        })
        throw new Error('Unable to prepend changelog.')
    }

    const newEntries = Object.entries(changeset)
        .sort(([pkgNameA], [pkgNameB]) => pkgNameA.localeCompare(pkgNameB))
        .map(([, changesetValue]) => changesetValue.changelog)
        .filter(value => value)
        .join('\n')
        .trim()

    changelogContents.splice(changelogOffset + 1, 0, `\n${newEntries}\n`)

    const dataToWrite = changelogContents.join('\n')

    if (config.dryRun && !config.forceWriteChangeFiles) {
        logging.debug(`[Changelog] Skipping changelog update.`, {
            report: context.report,
        })
    } else {
        await fs.writeFile(changelogFilename, dataToWrite, {
            encoding: 'utf-8',
        })
    }

    logging.info(`[Changelog] Updated ${changelogFilename}`, {
        report: context.report,
    })
}

export default prependChangelogFile