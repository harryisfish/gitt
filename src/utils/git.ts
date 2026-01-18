import { simpleGit } from 'simple-git';
import { GitError } from '../errors';
import { readConfigFile, writeConfigFile } from './config';

const git = simpleGit();

/**
 * Get the main branch name for the current repository.
 * Priority:
 * 1. User config (gitt.mainBranch)
 * 2. Remote HEAD (origin/HEAD)
 * 3. Common names (main, master)
 */
export async function getMainBranch(): Promise<string> {
    try {
        // 1. Check .gitt config file
        const fileConfig = await readConfigFile();
        if (fileConfig.mainBranch) {
            return fileConfig.mainBranch;
        }

        // 2. Check user config (legacy/fallback)
        const configMain = await git.getConfig('gitt.mainBranch');
        if (configMain.value) {
            return configMain.value;
        }

        // 3. Try to detect from remote HEAD
        try {
            const remotes = await git.listRemote(['--symref', 'origin', 'HEAD']);
            // Output format example: "ref: refs/heads/main\tHEAD"
            const match = remotes.match(/ref: refs\/heads\/([^\s]+)\s+HEAD/);
            if (match && match[1]) {
                return match[1];
            }
        } catch (e) {
            // Ignore network/remote errors during detection
        }

        // 4. Check for common local branches
        const localBranches = await git.branchLocal();
        if (localBranches.all.includes('main')) return 'main';
        if (localBranches.all.includes('master')) return 'master';

        // Default fallback
        return 'main';
    } catch (error) {
        throw new GitError('Failed to detect main branch');
    }
}

/**
 * Set the preferred main branch for the current repository.
 */
export async function setMainBranch(branch: string): Promise<void> {
    try {
        // Verify branch exists locally or remotely
        const localBranches = await git.branchLocal();
        if (!localBranches.all.includes(branch)) {
            // If not local, check if we can fetch it
            try {
                await git.fetch(['origin', branch]);
            } catch (e) {
                throw new GitError(`Branch '${branch}' does not exist locally or on remote`);
            }
        }

        await writeConfigFile({ mainBranch: branch });
    } catch (error) {
        if (error instanceof GitError) throw error;
        throw new GitError('Failed to set main branch configuration');
    }
}
/**
 * Check if a branch is merged into the main branch.
 * Supports regular merge, squash merge, and rebase merge detection.
 */
export async function isBranchMerged(branch: string, mainBranch: string): Promise<boolean> {
    try {
        // Method 1: Check regular merge with git branch --merged
        const mergedBranches = await git.branch(['--merged', mainBranch]);
        if (mergedBranches.all.includes(branch)) {
            return true;
        }

        // Method 2: Check squash/rebase merge with git cherry
        // git cherry returns empty or all lines start with '-' if fully merged
        // '-' means the commit exists in upstream (merged)
        // '+' means the commit does not exist in upstream (not merged)
        const cherryOutput = await git.raw(['cherry', mainBranch, branch]);
        const lines = cherryOutput.trim().split('\n').filter(Boolean);

        // If no commits unique to branch, or all commits are merged (start with -)
        if (lines.length === 0) {
            return true;
        }

        // Check if all commits are merged (all lines start with '-')
        const hasUnmergedCommits = lines.some(line => line.startsWith('+'));
        return !hasUnmergedCommits;
    } catch (error) {
        return false;
    }
}

/**
 * Get a list of branches that are currently checked out in worktrees.
 */
export async function getWorktrees(): Promise<string[]> {
    try {
        // Output format:
        // /path/to/repo    (HEAD detached at 123456)
        // /path/to/worktree    [branch-name]
        const worktrees = await git.raw(['worktree', 'list']);
        const lines = worktrees.split('\n').filter(Boolean);

        const branches: string[] = [];
        for (const line of lines) {
            // Extract branch name from [branch-name]
            const match = line.match(/\[(.*?)\]/);
            if (match && match[1]) {
                branches.push(match[1]);
            }
        }
        return branches;
    } catch (error) {
        // If worktrees are not supported or error occurs, return empty list
        return [];
    }
}

/**
 * Get the last commit time (in days) for a branch.
 * Returns the number of days since the last commit.
 */
export async function getBranchLastCommitTime(branch: string): Promise<number> {
    try {
        // Get unix timestamp of last commit
        const timestamp = await git.raw(['log', '-1', '--format=%at', branch]);
        const lastCommitDate = new Date(parseInt(timestamp.trim()) * 1000);
        const now = new Date();

        const diffTime = Math.abs(now.getTime() - lastCommitDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    } catch (error) {
        // If branch doesn't exist or error, return 0 (treat as active/new to be safe)
        return 0;
    }
}
