#!/usr/bin/env node

import { select, confirm } from '@inquirer/prompts';
import { simpleGit } from 'simple-git';
import { GitError, UserCancelError, handleError, printSuccess, printError } from './errors';

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
        // 在程序启动时检查 Git 仓库状态
        await checkGitRepo();
        printSuccess('Git 仓库检查通过\n');

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