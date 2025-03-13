import { select, input, confirm } from '@inquirer/prompts';
import { simpleGit } from 'simple-git';
import { GitError, printSuccess } from '../errors';

const git = simpleGit();

interface CommitInfo {
    hash: string;
    message: string;
    date: string;
    author: string;
}

export async function interactiveRebase() {
    try {
        // 获取当前分支最近的提交记录
        const commits = await getRecentCommits();
        
        // 选择要变基的提交范围
        const targetCommit = await selectCommitRange(commits);
        if (!targetCommit) return;

        // 选择变基操作类型
        const action = await selectRebaseAction();
        
        // 根据不同的操作类型执行相应的变基操作
        switch (action) {
            case 'squash':
                await handleSquashRebase(targetCommit);
                break;
            case 'reword':
                await handleRewordRebase(targetCommit);
                break;
            case 'drop':
                await handleDropRebase(targetCommit);
                break;
            case 'reorder':
                await handleReorderRebase(targetCommit);
                break;
        }
    } catch (error) {
        if (error instanceof Error) {
            throw new GitError(`变基操作失败: ${error.message}`);
        }
        throw error;
    }
}

// 获取最近的提交记录
async function getRecentCommits(count: number = 10): Promise<CommitInfo[]> {
    const log = await git.log(['--max-count=' + count]);
    return log.all.map(commit => ({
        hash: commit.hash,
        message: commit.message,
        date: commit.date,
        author: commit.author_name
    }));
}

// 选择要变基的提交范围
async function selectCommitRange(commits: CommitInfo[]): Promise<string | null> {
    const choices = commits.map(commit => ({
        name: `${commit.hash.substring(0, 7)} - ${commit.date.split('T')[0]} - ${commit.message}`,
        value: commit.hash
    }));

    const targetCommit = await select({
        message: '请选择要变基到的提交（此提交之后的所有提交都将被包含在变基操作中）：',
        choices: [
            ...choices,
            { name: '取消', value: null }
        ]
    });

    return targetCommit;
}

// 选择变基操作类型
async function selectRebaseAction(): Promise<'squash' | 'reword' | 'drop' | 'reorder'> {
    return await select({
        message: '请选择要执行的变基操作：',
        choices: [
            {
                name: '合并多个提交 (squash)',
                value: 'squash',
                description: '将多个提交合并为一个提交'
            },
            {
                name: '修改提交信息 (reword)',
                value: 'reword',
                description: '修改某个提交的提交信息'
            },
            {
                name: '删除提交 (drop)',
                value: 'drop',
                description: '删除某个提交'
            },
            {
                name: '调整提交顺序 (reorder)',
                value: 'reorder',
                description: '改变提交的顺序'
            }
        ]
    });
}

// 处理压缩提交的变基操作
async function handleSquashRebase(targetCommit: string) {
    const confirmed = await confirm({
        message: '此操作将打开编辑器进行交互式变基，是否继续？',
        default: true
    });

    if (!confirmed) return;

    // 执行交互式变基
    await git.raw(['rebase', '-i', `${targetCommit}~1`]);
    printSuccess('变基操作已完成，请检查提交历史');
}

// 处理修改提交信息的变基操作
async function handleRewordRebase(targetCommit: string) {
    const newMessage = await input({
        message: '请输入新的提交信息：'
    });

    if (!newMessage) return;

    await git.raw(['rebase', '-i', `${targetCommit}~1`]);
    printSuccess('提交信息已更新，请检查提交历史');
}

// 处理删除提交的变基操作
async function handleDropRebase(targetCommit: string) {
    const confirmed = await confirm({
        message: '⚠️ 删除提交是一个危险操作，确定要继续吗？',
        default: false
    });

    if (!confirmed) return;

    await git.raw(['rebase', '-i', `${targetCommit}~1`]);
    printSuccess('提交已删除，请检查提交历史');
}

// 处理调整提交顺序的变基操作
async function handleReorderRebase(targetCommit: string) {
    const confirmed = await confirm({
        message: '此操作将打开编辑器让您调整提交顺序，是否继续？',
        default: true
    });

    if (!confirmed) return;

    await git.raw(['rebase', '-i', `${targetCommit}~1`]);
    printSuccess('提交顺序已调整，请检查提交历史');
} 