import { simpleGit } from 'simple-git';
import { GitError } from '../errors';
import { printSuccess } from '../errors';

const git = simpleGit();

/**
 * Clean up local branches that have been deleted on the remote
 * @throws {GitError} When cleaning operation fails
 */
export async function cleanDeletedBranches() {
    try {
        console.log('Switching to main branch...');
        await git.checkout('main');
        
        console.log('Pulling latest code...');
        await git.pull();
        
        console.log('Cleaning up remotely deleted branches...');
        // 获取最新的远程分支信息
        await git.fetch(['--prune']);
        
        // 获取所有分支信息
        const branchSummary = await git.branch(['-vv']);
        
        // 找出已经在远程被删除的分支
        const deletedBranches = branchSummary.all.filter(branch => {
            const branchInfo = branchSummary.branches[branch];
            return branchInfo.label && branchInfo.label.includes(': gone]');
        });
        
        if (deletedBranches.length === 0) {
            console.log('No branches need to be cleaned up.');
            return;
        }
        
        console.log('The following branches will be deleted:', deletedBranches.join(', '));
        
        // 删除这些分支
        for (const branch of deletedBranches) {
            await git.branch(['-D', branch]);
            console.log(`Deleted branch: ${branch}`);
        }
        
        printSuccess('Branch cleanup completed');
    } catch (error) {
        throw new GitError(error instanceof Error ? error.message : 'Unknown error occurred while cleaning branches');
    }
} 