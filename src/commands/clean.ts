import { simpleGit } from 'simple-git';
import { Listr } from 'listr2';
import { GitError } from '../errors';
import { printSuccess } from '../errors';

const git = simpleGit();

/**
 * Clean up local branches that have been deleted on the remote
 * @throws {GitError} When cleaning operation fails
 */
export async function cleanDeletedBranches() {
    try {
        const tasks = new Listr([
            {
                title: 'Switch to main branch',
                task: async () => {
                    await git.checkout('main');
                }
            },
            {
                title: 'Pull latest code',
                task: async () => {
                    await git.pull();
                }
            },
            {
                title: 'Fetch and prune remote branches',
                task: async (ctx: { deletedBranches?: string[] }) => {
                    await git.fetch(['--prune']);
                    const branchSummary = await git.branch(['-vv']);
                    const deletedBranches = branchSummary.all.filter(branch => {
                        const branchInfo = branchSummary.branches[branch];
                        return branchInfo.label && branchInfo.label.includes(': gone]');
                    });
                    ctx.deletedBranches = deletedBranches;
                }
            },
            {
                title: 'Delete branches removed on remote',
                enabled: (ctx) => Array.isArray((ctx as any).deletedBranches),
                skip: (ctx: { deletedBranches?: string[] }) => {
                    if (!ctx.deletedBranches || ctx.deletedBranches.length === 0) {
                        return 'No branches need to be cleaned up';
                    }
                    return false;
                },
                task: (ctx: { deletedBranches?: string[] }) => {
                    return new Listr(
                        (ctx.deletedBranches || []).map(branch => ({
                            title: `Delete ${branch}`,
                            task: async () => {
                                await git.branch(['-D', branch]);
                            }
                        })),
                        { concurrent: false }
                    );
                }
            }
        ]);

        await tasks.run();
        printSuccess('Branch cleanup completed');
    } catch (error) {
        throw new GitError(error instanceof Error ? error.message : 'Unknown error occurred while cleaning branches');
    }
}