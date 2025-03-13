#!/usr/bin/env node

import { select, confirm } from '@inquirer/prompts';
import { simpleGit } from 'simple-git';
import { GitError, UserCancelError, handleError, printSuccess, printError } from './errors';
import { display } from './display';
import { interactiveRebase } from './commands/rebase';
import { cleanDeletedBranches } from './commands/clean';
import { advancedStash } from './commands/stash';

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
        // 获取当前分支信息
        const currentBranch = await git.branch();
        const currentBranchName = currentBranch.current;

        // 获取最新的远程分支信息
        await git.fetch(['--all']);

        // 获取本地与远程的差异统计
        const status = await git.status();
        const uncommittedChanges = status.modified.length + status.not_added.length + status.deleted.length;

        // 更新简洁状态栏
        display.updateCompactStatus(currentBranchName, uncommittedChanges, status.ahead, status.behind);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        display.showError(`获取仓库状态信息时发生错误: ${errorMessage}`);
    }
}

// 显示详细的仓库状态信息
async function showDetailedRepoStatus() {
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

        // 显示详细状态
        display.showDetailedStatus(statusLines);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        display.showError(`获取仓库状态信息时发生错误: ${errorMessage}`);
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
                    name: '交互式变基',
                    value: 'rebase',
                    description: '合并、编辑、删除或重排提交记录'
                },
                {
                    name: '储藏管理',
                    value: 'stash',
                    description: '创建、管理和应用储藏'
                },
                {
                    name: '查看详细状态',
                    value: 'status',
                    description: '查看仓库的详细状态信息，包括提交记录和分支统计'
                },
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

            if (action === 'status') {
                await showDetailedRepoStatus();
            } else if (action === 'clean') {
                await cleanDeletedBranches();
            } else if (action === 'rebase') {
                await interactiveRebase();
            } else if (action === 'stash') {
                await advancedStash();
            }

            console.log('\n');
        }
    } catch (error) {
        handleError(error);
    }
}

// 启动程序
main().catch(handleError);