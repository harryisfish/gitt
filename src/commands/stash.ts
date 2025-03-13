import { select, input, confirm, checkbox } from '@inquirer/prompts';
import { simpleGit } from 'simple-git';
import { GitError, printSuccess } from '../errors';

const git = simpleGit();

interface StashEntry {
    index: number;
    hash: string;
    message: string;
    date: string;
}

/**
 * Advanced stash management functionality
 * @description Provides interactive interface for managing git stashes
 * @throws {GitError} When stash operation fails
 */
export async function advancedStash() {
    try {
        const action = await select({
            message: '请选择储藏操作：',
            choices: [
                {
                    name: '创建新储藏',
                    value: 'create',
                    description: '储藏当前的修改'
                },
                {
                    name: '储藏部分文件',
                    value: 'partial',
                    description: '选择性储藏部分文件的修改'
                },
                {
                    name: '管理储藏列表',
                    value: 'manage',
                    description: '查看、应用或删除已有的储藏'
                },
                {
                    name: '返回主菜单',
                    value: 'back'
                }
            ]
        });

        switch (action) {
            case 'create':
                await createStash();
                break;
            case 'partial':
                await createPartialStash();
                break;
            case 'manage':
                await manageStashes();
                break;
            case 'back':
                return;
        }
    } catch (error) {
        if (error instanceof Error) {
            throw new GitError(`储藏操作失败: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Create a new stash with optional message and untracked files
 */
async function createStash() {
    // 检查是否有可储藏的修改
    const status = await git.status();
    if (status.files.length === 0) {
        console.log('没有可储藏的修改。');
        return;
    }

    // 询问是否包含未跟踪的文件
    const includeUntracked = await confirm({
        message: '是否包含未跟踪的文件？',
        default: false
    });

    // 获取储藏信息
    const message = await input({
        message: '请输入储藏说明（可选）：'
    });

    // 执行储藏操作
    const args = ['push'];
    if (includeUntracked) args.push('-u');
    if (message) args.push('-m', message);

    await git.stash(args);
    printSuccess('修改已成功储藏');
}

/**
 * Create a partial stash by selecting specific files
 */
async function createPartialStash() {
    // 获取当前状态
    const status = await git.status();
    if (status.files.length === 0) {
        console.log('没有可储藏的修改。');
        return;
    }

    // 列出所有修改的文件供选择
    const fileChoices = status.files.map(file => ({
        name: `${file.path} (${file.index}${file.working_dir})`,
        value: file.path
    }));

    const selectedFiles = await checkbox({
        message: '请选择要储藏的文件（空格选择，回车确认）：',
        choices: fileChoices
    });

    if (selectedFiles.length === 0) {
        console.log('未选择任何文件，操作已取消。');
        return;
    }

    // 获取储藏信息
    const message = await input({
        message: '请输入储藏说明（可选）：'
    });

    // 执行部分储藏
    await git.raw(['stash', 'push', '-p', ...(message ? ['-m', message] : []), ...selectedFiles]);
    printSuccess('选中的文件已成功储藏');
}

/**
 * Manage existing stashes (list, apply, drop)
 */
async function manageStashes() {
    // 获取所有储藏
    const stashList = await getStashList();
    if (stashList.length === 0) {
        console.log('没有找到任何储藏。');
        return;
    }

    // 显示储藏列表
    const choices = stashList.map(stash => ({
        name: `stash@{${stash.index}}: ${stash.message} (${stash.date})`,
        value: stash.index
    }));

    const selectedStash = await select({
        message: '请选择要操作的储藏：',
        choices: [
            ...choices,
            { name: '返回', value: -1 }
        ]
    });

    if (selectedStash === -1) return;

    // 选择操作
    const operation = await select({
        message: '请选择操作：',
        choices: [
            {
                name: '应用储藏',
                value: 'apply',
                description: '应用选中的储藏（保留储藏记录）'
            },
            {
                name: '弹出储藏',
                value: 'pop',
                description: '应用并删除选中的储藏'
            },
            {
                name: '删除储藏',
                value: 'drop',
                description: '删除选中的储藏'
            },
            {
                name: '查看储藏内容',
                value: 'show',
                description: '显示储藏的详细内容'
            }
        ]
    });

    // 执行选中的操作
    switch (operation) {
        case 'apply':
            await git.stash(['apply', `stash@{${selectedStash}}`]);
            printSuccess('储藏已应用');
            break;
        case 'pop':
            await git.stash(['pop', `stash@{${selectedStash}}`]);
            printSuccess('储藏已弹出');
            break;
        case 'drop':
            const confirmed = await confirm({
                message: '确定要删除这个储藏吗？此操作不可撤销。',
                default: false
            });
            if (confirmed) {
                await git.stash(['drop', `stash@{${selectedStash}}`]);
                printSuccess('储藏已删除');
            }
            break;
        case 'show':
            const diff = await git.stash(['show', '-p', `stash@{${selectedStash}}`]);
            console.log('\n储藏内容：\n', diff);
            break;
    }
}

/**
 * Get list of all stashes
 */
async function getStashList(): Promise<StashEntry[]> {
    const result = await git.stash(['list']);
    if (!result) return [];

    return result
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
            const match = line.match(/^stash@{(\d+)}: (.*)/);
            if (!match) return null;
            
            return {
                index: parseInt(match[1]),
                hash: '',  // 可以通过额外命令获取完整 hash
                message: match[2],
                date: ''   // 可以通过额外命令获取详细时间
            };
        })
        .filter((entry): entry is StashEntry => entry !== null);
} 