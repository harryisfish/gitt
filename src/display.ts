import { clearLine, cursorTo } from 'readline';

// ANSI 转义序列
const CLEAR_SCREEN = '\x1b[2J';
const MOVE_TO_TOP = '\x1b[H';
const SAVE_CURSOR = '\x1b[s';
const RESTORE_CURSOR = '\x1b[u';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

class DisplayManager {
    private statusSection: string[] = [];
    private menuSection: string[] = [];
    private dividerLine: string = '';
    private isLoading: boolean = true;

    constructor() {
        // 获取终端大小
        const { rows, columns } = process.stdout;
        // 创建分隔线
        this.dividerLine = '─'.repeat(columns);
        // 计算上下区域的大小
        this.statusHeight = Math.floor(rows / 2) - 1;
        this.menuHeight = rows - this.statusHeight - 1;
    }

    private statusHeight: number;
    private menuHeight: number;

    // 清屏并初始化显示区域
    public initDisplay(): void {
        process.stdout.write(CLEAR_SCREEN + MOVE_TO_TOP);
        this.drawDivider();
        this.showLoadingStatus();
    }

    // 绘制分隔线
    private drawDivider(): void {
        process.stdout.write(SAVE_CURSOR);
        process.stdout.write(`\x1b[${this.statusHeight}H${this.dividerLine}`);
        process.stdout.write(RESTORE_CURSOR);
    }

    // 显示加载状态
    private showLoadingStatus(): void {
        if (this.isLoading) {
            process.stdout.write(MOVE_TO_TOP);
            process.stdout.write('正在获取仓库信息...\n');
        }
    }

    // 更新状态区域内容
    public updateStatus(lines: string[]): void {
        this.isLoading = false;
        this.statusSection = lines;
        this.refreshStatus();
    }

    // 刷新状态区域显示
    private refreshStatus(): void {
        process.stdout.write(SAVE_CURSOR);
        process.stdout.write(MOVE_TO_TOP);
        
        // 清空状态区域
        for (let i = 0; i < this.statusHeight; i++) {
            clearLine(process.stdout, 0);
            process.stdout.write('\n');
        }
        
        // 重新显示状态信息
        process.stdout.write(MOVE_TO_TOP);
        this.statusSection.forEach(line => {
            process.stdout.write(line + '\n');
        });
        
        process.stdout.write(RESTORE_CURSOR);
    }

    // 准备菜单区域
    public prepareForMenu(): void {
        process.stdout.write(`\x1b[${this.statusHeight + 1}H\n`);
    }

    // 显示错误信息
    public showError(message: string): void {
        const currentPos = process.stdout.rows;
        process.stdout.write(`\x1b[${currentPos}H\x1b[31m${message}\x1b[0m\n`);
    }
}

export const display = new DisplayManager(); 