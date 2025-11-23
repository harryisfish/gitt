import { simpleGit } from 'simple-git';
import { Listr } from 'listr2';
import { checkbox } from '@inquirer/prompts';
import { minimatch } from 'minimatch';
import { GitError } from '../errors';
import { printSuccess, printError } from '../errors';
import { getMainBranch } from '../utils/git';
import { readConfigFile } from '../utils/config';

const git = simpleGit();

interface CleanOptions {
    interactive?: boolean;
    dryRun?: boolean;
}

/**
 * Clean up local branches that have been deleted on the remote
 * @throws {GitError} When cleaning operation fails
 */
export async function cleanDeletedBranches(options: CleanOptions = {}) {
    try {
        const state = {
            mainBranch: '',
            deletedBranches: [] as string[]
        };

        // Phase 1: Discovery
        const discoveryTasks = new Listr([
            {
                title: 'Fetch main from remote',
                task: async (ctx: any) => {
                    const mainBranch = await getMainBranch();
                    ctx.mainBranch = mainBranch;
                    await git.fetch(['origin', mainBranch]);
                }
            },
            {
                title: 'Switch to main branch',
                task: async (ctx: any) => {
                    await git.checkout(ctx.mainBranch);
                }
            },
            {
                title: 'Sync main with remote',
                task: async () => {
                    await git.pull();
                }
            },
            {
                title: 'Fetch and prune remote branches',
                task: async (ctx: any) => {
                    await git.fetch(['--prune']);
                    const branchSummary = await git.branch(['-vv']);
                    const config = await readConfigFile();
                    const ignorePatterns = config.ignoreBranches || [];

                    let deletedBranches = branchSummary.all.filter(branch => {
                        const branchInfo = branchSummary.branches[branch];
                        return branchInfo.label && branchInfo.label.includes(': gone]');
                    });

                    // Filter out ignored branches
                    if (ignorePatterns.length > 0) {
                        deletedBranches = deletedBranches.filter(branch => {
                            const isIgnored = ignorePatterns.some(pattern => minimatch(branch, pattern));
                            return !isIgnored;
                        });
                    }

                    ctx.deletedBranches = deletedBranches;
                }
            }
        ]);

        await discoveryTasks.run(state);

        // Phase 2: Interaction / Filtering
        if (state.deletedBranches.length === 0) {
            printSuccess('No branches need to be cleaned up');
            return;
        }

        if (options.interactive) {
            try {
                const selected = await checkbox({
                    message: 'Select branches to delete:',
                    choices: state.deletedBranches.map(b => ({ name: b, value: b, checked: true })),
                });
                state.deletedBranches = selected;
            } catch (e) {
                // User cancelled
                throw new Error('Operation cancelled');
            }
        }

        if (state.deletedBranches.length === 0) {
            printSuccess('No branches selected for deletion');
            return;
        }

        if (options.dryRun) {
            console.log('\nDry Run: The following branches would be deleted:');
            state.deletedBranches.forEach(b => console.log(`  - ${b}`));
            return;
        }

        // Phase 3: Execution
        const deleteTasks = new Listr([
            {
                title: 'Delete branches removed on remote',
                task: (ctx: any) => {
                    return new Listr(
                        state.deletedBranches.map(branch => ({
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

        await deleteTasks.run(state);
        printSuccess('Branch cleanup completed');
    } catch (error) {
        throw new GitError(error instanceof Error ? error.message : 'Unknown error occurred while cleaning branches');
    }
}