import { simpleGit } from 'simple-git';
import { Listr } from 'listr2';
import { checkbox } from '@inquirer/prompts';
import { minimatch } from 'minimatch';
import { GitError } from '../errors';
import { printSuccess, printError } from '../errors';
import { getMainBranch, isBranchMerged, getWorktrees, getBranchLastCommitTime } from '../utils/git';
import { readConfigFile } from '../utils/config';

const git = simpleGit();

interface CleanOptions {
    interactive?: boolean;
    dryRun?: boolean;
    stale?: boolean;
    staleDays?: number;
}

/**
 * Clean up local branches that have been deleted on the remote
 * @throws {GitError} When cleaning operation fails
 */
export async function cleanDeletedBranches(options: CleanOptions = {}) {
    try {
        const state = {
            mainBranch: '',
            deletedBranches: [] as { name: string; isMerged: boolean; reason?: string }[]
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
                    // Check if we are on a branch that will be deleted? 
                    // For now, just try to switch to main to be safe.
                    // But if main is checked out in another worktree, this might fail?
                    // Let's just try.
                    try {
                        await git.checkout(ctx.mainBranch);
                    } catch (e) {
                        // If we can't checkout main (e.g. dirty state), warn but continue?
                        // Ideally we should be on main to delete other branches safely.
                    }
                }
            },
            {
                title: 'Sync main with remote',
                task: async () => {
                    try {
                        await git.pull();
                    } catch (e) {
                        // Ignore pull errors (e.g. if not on branch)
                    }
                }
            },
            {
                title: 'Analyze branches',
                task: async (ctx: any) => {
                    await git.fetch(['--prune']);
                    const branchSummary = await git.branch(['-vv']);
                    const config = await readConfigFile();
                    const ignorePatterns = config.ignoreBranches || [];
                    const worktreeBranches = await getWorktrees();

                    let candidates: { name: string; reason: string }[] = [];

                    if (options.stale) {
                        // Stale mode: check all local branches
                        const allBranches = branchSummary.all;
                        for (const branch of allBranches) {
                            if (branch === ctx.mainBranch) continue;

                            const days = await getBranchLastCommitTime(branch);
                            if (days > (options.staleDays || 90)) {
                                candidates.push({
                                    name: branch,
                                    reason: `Stale (${days} days)`
                                });
                            }
                        }
                    } else {
                        // Default mode: check "gone" branches
                        const goneBranches = branchSummary.all.filter(branch => {
                            const branchInfo = branchSummary.branches[branch];
                            return branchInfo.label && branchInfo.label.includes(': gone]');
                        });
                        candidates = goneBranches.map(b => ({ name: b, reason: 'Remote deleted' }));
                    }

                    // Filter out ignored branches
                    if (ignorePatterns.length > 0) {
                        candidates = candidates.filter(c => {
                            const isIgnored = ignorePatterns.some(pattern => minimatch(c.name, pattern));
                            return !isIgnored;
                        });
                    }

                    // Filter out worktree branches
                    candidates = candidates.filter(c => !worktreeBranches.includes(c.name));

                    // Check merge status for each branch
                    const branchesWithStatus = await Promise.all(candidates.map(async (c) => {
                        const isMerged = await isBranchMerged(c.name, ctx.mainBranch);
                        return { ...c, isMerged };
                    }));

                    ctx.deletedBranches = branchesWithStatus;
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
                const choices = state.deletedBranches.map(b => ({
                    name: `${b.name} (${b.reason}${b.isMerged ? '' : ', Unmerged'})`,
                    value: b,
                    checked: b.isMerged // Only check merged branches by default
                }));

                const selected = await checkbox({
                    message: 'Select branches to delete:',
                    choices: choices,
                });
                state.deletedBranches = selected;
            } catch (e) {
                // User cancelled
                throw new Error('Operation cancelled');
            }
        } else {
            // Auto mode: Filter out unmerged branches
            const unmerged = state.deletedBranches.filter(b => !b.isMerged);
            if (unmerged.length > 0) {
                console.log('\nSkipping unmerged branches (use -i to force delete):');
                unmerged.forEach(b => console.log(`  - ${b.name} (${b.reason})`));
            }
            state.deletedBranches = state.deletedBranches.filter(b => b.isMerged);
        }

        if (state.deletedBranches.length === 0) {
            printSuccess('No branches selected for deletion');
            return;
        }

        if (options.dryRun) {
            console.log('\nDry Run: The following branches would be deleted:');
            state.deletedBranches.forEach(b => console.log(`  - ${b.name} (${b.reason})`));
            return;
        }

        // Phase 3: Execution
        const deleteTasks = new Listr([
            {
                title: 'Delete branches',
                task: (ctx: any) => {
                    return new Listr(
                        state.deletedBranches.map(branch => ({
                            title: `Delete ${branch.name}`,
                            task: async () => {
                                // Always use -D to force delete if we are here (user confirmed or it's merged)
                                await git.branch(['-D', branch.name]);
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