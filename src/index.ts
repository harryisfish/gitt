#!/usr/bin/env node

import { simpleGit } from 'simple-git';
import { GitError, UserCancelError, handleError, printSuccess, printError } from './errors';
import { cleanDeletedBranches } from './commands/clean';

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
        throw new GitError('当前目录不是 Git 仓库');
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

async function main() {
    try {
        // 检查 Git 仓库
        await checkGitRepo();
        
        // 执行清理操作
        await cleanDeletedBranches();
        
        // 退出程序
        process.exit(0);
    } catch (error) {
        handleError(error);
        process.exit(1);
    }
}

// 启动程序
main().catch(handleError);