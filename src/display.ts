import { clearLine, cursorTo } from 'readline';

// ANSI 转义序列
const CLEAR_SCREEN = '\x1b[2J';
const CLEAR_SCREEN_AND_SCROLLBACK = '\x1b[2J\x1b[3J';
const MOVE_TO_TOP = '\x1b[H';
const SAVE_CURSOR = '\x1b[s';
const RESTORE_CURSOR = '\x1b[u';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const ALTERNATE_SCREEN_BUFFER = '\x1b[?1049h';
const NORMAL_SCREEN_BUFFER = '\x1b[?1049l';

class DisplayManager {
    private statusSection: string[] = [];
    private menuSection: string[] = [];
    private dividerLine: string = '';
    private isLoading: boolean = true;
    private isDetailedView: boolean = false;
    private terminalSize: {rows: number, columns: number};

    constructor() {
        // 获取终端大小
        this.terminalSize = {rows: process.stdout.rows, columns: process.stdout.columns};
        // 创建分隔线
        this.updateDividerLine();
        // 计算上下区域的大小 - 状态区域只占一行
        this.statusHeight = 1;
        this.menuHeight = this.terminalSize.rows - this.statusHeight - 1;
        
        // 监听终端大小变化
        process.stdout.on('resize', () => {
            this.terminalSize = {rows: process.stdout.rows, columns: process.stdout.columns};
            this.updateDividerLine();
            this.menuHeight = this.terminalSize.rows - this.statusHeight - 1;
            if (!this.isDetailedView) {
                this.redrawScreen();
            }
        });
    }
    
    private updateDividerLine(): void {
        this.dividerLine = '─'.repeat(this.terminalSize.columns);
    }

    private statusHeight: number;
    private menuHeight: number;

    // 清屏并初始化显示区域
    public initDisplay(): void {
        // 切换到备用屏幕缓冲区，实现全屏模式
        process.stdout.write(ALTERNATE_SCREEN_BUFFER);
        process.stdout.write(CLEAR_SCREEN_AND_SCROLLBACK + MOVE_TO_TOP);
        process.stdout.write(HIDE_CURSOR);
        this.drawDivider();
        this.showLoadingStatus();
        
        // 确保程序退出时恢复终端状态
        process.on('exit', () => {
            process.stdout.write(SHOW_CURSOR);
            process.stdout.write(NORMAL_SCREEN_BUFFER);
        });
    }

    // 绘制分隔线
    private drawDivider(): void {
        process.stdout.write(SAVE_CURSOR);
        process.stdout.write(`\x1b[${this.statusHeight + 1}H${this.dividerLine}`);
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
    
    // 更新简洁状态栏
    public updateCompactStatus(branchName: string, uncommittedChanges: number, ahead: number, behind: number): void {
        this.isLoading = false;
        const statusLine = `🌿 ${branchName} | 📝 ${uncommittedChanges} | ⬆️ ${ahead} | ⬇️ ${behind}`;
        this.statusSection = [statusLine];
        this.refreshStatus();
    }
    
    // 显示详细状态信息
    public showDetailedStatus(lines: string[]): void {
        this.isDetailedView = true;
        process.stdout.write(CLEAR_SCREEN + MOVE_TO_TOP);
        lines.forEach(line => {
            process.stdout.write(line + '\n');
        });
        process.stdout.write('\n按任意键返回主菜单...');
        // 监听一次按键事件
        process.stdin.setRawMode(true);
        process.stdin.once('data', () => {
            process.stdin.setRawMode(false);
            this.isDetailedView = false;
            this.redrawScreen();
        });
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
    
    // 重绘整个屏幕
    private redrawScreen(): void {
        process.stdout.write(CLEAR_SCREEN + MOVE_TO_TOP);
        this.drawDivider();
        this.refreshStatus();
        this.prepareForMenu();
    }

    // 准备菜单区域
    public prepareForMenu(): void {
        // 将光标移动到分隔线下方
        process.stdout.write(`\x1b[${this.statusHeight + 2}H`);
        // 清除菜单区域
        for (let i = this.statusHeight + 2; i < this.terminalSize.rows; i++) {
            process.stdout.write(`\x1b[${i}H`);
            clearLine(process.stdout, 0);
        }
        // 重新定位到菜单开始位置
        process.stdout.write(`\x1b[${this.statusHeight + 2}H`);
    }

    // 显示错误信息
    public showError(message: string): void {
        const currentPos = process.stdout.rows;
        process.stdout.write(`\x1b[${currentPos}H\x1b[31m${message}\x1b[0m\n`);
    }
}

export const display = new DisplayManager();