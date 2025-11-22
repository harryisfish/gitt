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
