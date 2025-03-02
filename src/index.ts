#!/usr/bin/env node

import { select, confirm } from '@inquirer/prompts';
import { simpleGit } from 'simple-git';
import { GitError, UserCancelError, handleError, printSuccess, printError } from './errors';
import { display } from './display';

const git = simpleGit();

// 处理 Ctrl+C 和其他终止信号
process.on('SIGINT', () => {
    throw new UserCancelError('\n操作已取消');
});

process.on('SIGTERM', () => {
    throw new UserCancelError('\n程序被终止');
});

// 初始化 Git 仓库
async function initGitRepo() {
    try {
        await git.init();
        printSuccess('Git 仓库初始化成功');
    } catch (error) {
        throw new GitError('Git 仓库初始化失败');
    }
}

// 检查当前目录是否是 Git 仓库
async function checkGitRepo() {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
        const shouldInit = await confirm({
            message: '当前目录不是 Git 仓库，是否要创建？',
            default: true
        });
        
        if (shouldInit) {
            await initGitRepo();
        } else {
            throw new UserCancelError();
        }
    }

    // 检查是否有远程仓库配置
    const remotes = await git.getRemotes();
    if (remotes.length === 0) {
        throw new GitError('当前 Git 仓库未配置远程仓库');
    }

    // 检查是否能访问远程仓库
    try {
        await git.fetch(['--dry-run']);
    } catch (error) {
        throw new GitError('无法访问远程仓库，请检查网络连接或仓库权限');
    }
}

// 异步获取并展示仓库状态信息
async function showRepoStatus() {
    try {
        const statusLines: string[] = [];

        // 获取当前分支信息
        const currentBranch = await git.branch();
        const currentBranchName = currentBranch.current;
        statusLines.push(`当前分支: ${currentBranchName}\n`);

        // 获取最新的远程分支信息
        await git.fetch(['--all']);

        // 获取本地与远程的差异统计
        const status = await git.status();
        statusLines.push('📊 本地仓库状态:');
        statusLines.push(`- 未提交的修改: ${status.modified.length + status.not_added.length + status.deleted.length} 个文件`);
        if (status.ahead > 0) {
            statusLines.push(`- 领先远程分支: ${status.ahead} 个提交`);
        }
        if (status.behind > 0) {
            statusLines.push(`- 落后远程分支: ${status.behind} 个提交`);
        }
        statusLines.push('');

        // 获取最近的提交信息
        const recentCommits = await git.log(['--max-count=5']);
        statusLines.push('📝 最近提交记录:');
        recentCommits.all.forEach(commit => {
            statusLines.push(`- ${commit.date.split('T')[0]} ${commit.hash.substring(0, 7)} ${commit.message}`);
        });
        statusLines.push('');

        // 获取所有分支信息
        const branchSummary = await git.branch(['-vv']);
        const localBranches = branchSummary.all.length;
        const remoteBranches = Object.keys(branchSummary.branches).filter(b => branchSummary.branches[b].label?.includes('/')).length;
        
        statusLines.push('🌳 分支信息:');
        statusLines.push(`- 本地分支数: ${localBranches}`);
        statusLines.push(`- 远程分支数: ${remoteBranches}`);

        // 更新显示
        display.updateStatus(statusLines);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        display.showError(`获取仓库状态信息时发生错误: ${errorMessage}`);
    }
}

async function cleanDeletedBranches() {
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

async function showMenu() {
    try {
        // 准备菜单区域
        display.prepareForMenu();

        const action = await select({
            message: '请选择要执行的操作：',
            choices: [
                {
                    name: '清理远程已删除的分支',
                    value: 'clean',
                    description: '清理那些在远程仓库已经被删除的本地分支'
                },
                {
                    name: '退出',
                    value: 'exit',
                    description: '退出程序'
                }
            ]
        });

        return action;
    } catch (error) {
        printError('菜单选择出错');
        return 'exit';
    }
}

async function main() {
    try {
        // 初始化显示
        display.initDisplay();

        // 在程序启动时只进行基本的 Git 仓库检查
        await checkGitRepo();
        
        // 在后台异步获取仓库状态
        showRepoStatus().catch(error => {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            display.showError(`获取仓库状态时发生错误: ${errorMessage}`);
        });

        while (true) {
            const action = await showMenu();
            
            if (action === 'exit') {
                console.log('再见！');
                process.exit(0);
            }

            if (action === 'clean') {
                await cleanDeletedBranches();
            }

            console.log('\n');
        }
    } catch (error) {
        handleError(error);
    }
}

// 启动程序
main().catch(handleError); 