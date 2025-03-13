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
        console.log('正在切换到 main 分支...');
        await git.checkout('main');
        
        console.log('正在拉取最新代码...');
        await git.pull();
        
        console.log('正在清理远程已删除的分支...');
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
            console.log('没有需要清理的分支。');
            return;
        }
        
        console.log('以下分支将被删除：', deletedBranches.join(', '));
        
        // 删除这些分支
        for (const branch of deletedBranches) {
            await git.branch(['-D', branch]);
            console.log(`已删除分支: ${branch}`);
        }
        
        printSuccess('分支清理完成');
    } catch (error) {
        throw new GitError(error instanceof Error ? error.message : '清理分支时发生未知错误');
    }
} 