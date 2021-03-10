import { promises as fs } from 'fs'
import path from 'path'

import logging from '@monodeploy/logging'
import { getMonodeployConfig, setupMonorepo } from '@monodeploy/test-utils'

import { getDependents } from '.'

describe('@monodeploy/dependencies', () => {
    let context

    beforeEach(async () => {
        context = await setupMonorepo({
            'pkg-1': {},
            'pkg-2': {},
            'pkg-3': { dependencies: ['pkg-2'] },
            'pkg-4': {},
            'pkg-5': { private: true, dependencies: ['pkg-4'] },
            'pkg-6': {
                dependencies: ['pkg-3', 'pkg-7'],
            },
            'pkg-7': {},
        })
    })

    afterEach(async () => {
        try {
            await fs.rm(context.project.cwd, { recursive: true, force: true })
        } catch {}
    })

    it("Determines a package' dependents properly", async () => {
        // pkg-3 depends on pkg-2, pkg-6 depends on pkg-3
        const config = await getMonodeployConfig({
            cwd: context.project.cwd,
            baseBranch: 'master',
            commitSha: 'shashasha',
        })
        const dependents = await getDependents(
            config,
            context,
            new Set(['pkg-2']),
        )

        expect(dependents).toEqual(new Set(['pkg-3', 'pkg-6']))
    })

    it('Does not include dependents that are in the package list', async () => {
        // pkg-3 depends on pkg-2
        const config = await getMonodeployConfig({
            cwd: context.project.cwd,
            baseBranch: 'master',
            commitSha: 'shashasha',
        })

        const dependents = await getDependents(
            config,
            context,
            new Set(['pkg-2', 'pkg-3']),
        )

        expect(dependents).toEqual(new Set(['pkg-6']))
    })

    it('Errors if a dependent is unnamed', async () => {
        const config = await getMonodeployConfig({
            cwd: context.project.cwd,
            baseBranch: 'master',
            commitSha: 'shashasha',
        })

        // Stripping pkg-3 of its ident
        const pkg3Cwd = path.resolve(path.join(config.cwd, 'packages/pkg-3'))
        context.project.workspacesByCwd.get(pkg3Cwd).manifest.name = null
        await expect(
            async () =>
                await getDependents(config, context, new Set(['pkg-2'])),
        ).rejects.toEqual(new Error('Missing workspace identity.'))
    })

    it('Ignores private dependents', async () => {
        const config = await getMonodeployConfig({
            cwd: context.project.cwd,
            baseBranch: 'master',
            commitSha: 'shashasha',
        })

        // pkg-5 is a private dependent of pk-4
        const dependents = await getDependents(
            config,
            context,
            new Set(['pkg-4']),
        )
        expect(dependents).toEqual(new Set())
    })

    it('Only counts dependents once', async () => {
        const config = await getMonodeployConfig({
            cwd: context.project.cwd,
            baseBranch: 'master',
            commitSha: 'shashasha',
        })

        // pkg-6 is a dependent of both pkg-3 and pkg-7
        const dependents = await getDependents(
            config,
            context,
            new Set(['pkg-3', 'pkg-7']),
        )
        expect(dependents).toEqual(new Set(['pkg-6']))
    })

    it('skips unknown package names', async () => {
        const config = await getMonodeployConfig({
            cwd: context.project.cwd,
            baseBranch: 'master',
            commitSha: 'shashasha',
        })

        // pkg-6 is a dependent of both pkg-3 and pkg-7
        const dependents = await getDependents(
            config,
            context,
            new Set(['pkg-3', 'pkg-7', 'pkg-unknown']),
        )
        expect(dependents).toEqual(new Set(['pkg-6']))
    })
})

describe('cycles', () => {
    let context

    beforeEach(async () => {
        context = await setupMonorepo({
            'pkg-1': { dependencies: ['pkg-2'] },
            'pkg-2': { dependencies: ['pkg-3'] },
            'pkg-3': { dependencies: ['pkg-1'] },
        })
    })

    afterEach(async () => {
        try {
            await fs.rm(context.project.cwd, { recursive: true, force: true })
        } catch {}
        jest.restoreAllMocks()
    })

    it('handles cycles', async () => {
        const consoleSpy = jest
            .spyOn(logging, 'error')
            .mockImplementation(() => {
                /* ignore */
            })

        const config = await getMonodeployConfig({
            cwd: context.project.cwd,
            baseBranch: 'master',
            commitSha: 'shashasha',
        })
        const dependents = await getDependents(
            config,
            context,
            new Set(['pkg-2']),
        )

        expect(dependents).toEqual(new Set(['pkg-1', 'pkg-3']))
        expect(
            consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0],
        ).toEqual(expect.stringMatching('Cycle detected'))
    })
})