import { simpleGit } from 'simple-git';
import { Listr } from 'listr2';
import { checkbox } from '@inquirer/prompts';
import { minimatch } from 'minimatch';
import { GitError, UserCancelError, printSuccess } from '../errors';
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
            currentBranch: '',
            deletedBranches: [] as { name: string; isMerged: boolean; reason?: string }[]
        };

        // Phase 1: Discovery
        const discoveryTasks = new Listr([
            {
                title: 'Fetch and switch to main branch',
                task: async (ctx: any) => {
                    const mainBranch = await getMainBranch();
                    ctx.mainBranch = mainBranch;
                    const branchInfo = await git.branchLocal();
                    ctx.currentBranch = branchInfo.current;

                    // Fetch main branch first to avoid conflicts
                    await git.fetch(['origin', mainBranch]);

                    // Switch to main branch if not already on it
                    if (ctx.currentBranch !== mainBranch) {
                        await git.checkout(mainBranch);
                        await git.pull();
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
                        // Note: label may contain newlines/whitespace when branch names are long
                        const goneBranches = branchSummary.all.filter(branch => {
                            const branchInfo = branchSummary.branches[branch];
                            if (!branchInfo.label) return false;
                            // Normalize whitespace and check for "gone" status
                            const normalizedLabel = branchInfo.label.replace(/\s+/g, ' ');
                            return normalizedLabel.includes(': gone]');
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
                throw new UserCancelError('Operation cancelled');
            }
        } else {
            // Auto mode: Filter out unmerged branches
            const unmerged = state.deletedBranches.filter(b => !b.isMerged);
            state.deletedBranches = state.deletedBranches.filter(b => b.isMerged);

            if (state.deletedBranches.length === 0 && unmerged.length > 0) {
                printSuccess(`No merged branches to clean up (${unmerged.length} unmerged branch${unmerged.length > 1 ? 'es' : ''} skipped, use -i to review)`);
                return;
            }
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
                task: (_ctx: any) => {
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
        if (error instanceof GitError || error instanceof UserCancelError) {
            // Re-throw our custom errors as-is
            throw error;
        }
        // Wrap other errors and preserve the original error
        throw new GitError(
            error instanceof Error ? error.message : 'Unknown error occurred while cleaning branches',
            error instanceof Error ? error : undefined
        );
    }
}