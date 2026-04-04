use anyhow::Result;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseButton, MouseEvent, MouseEventKind};
use ratatui::layout::Rect;

use crate::git::{self, GitState};
use crate::update::UpdateChecker;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Tab {
    Status,
    Branch,
    Log,
}

impl Tab {
    pub const ALL: [Tab; 3] = [Tab::Status, Tab::Branch, Tab::Log];

    pub fn label(&self) -> &str {
        match self {
            Tab::Status => "Status",
            Tab::Branch => "Branch",
            Tab::Log => "Log",
        }
    }

    pub fn index(&self) -> usize {
        match self {
            Tab::Status => 0,
            Tab::Branch => 1,
            Tab::Log => 2,
        }
    }
}

pub enum AppEvent {
    Quit,
    Continue,
}

pub struct App {
    pub tab: Tab,
    pub git: GitState,
    pub selected: usize,
    pub scroll_offset: usize,
    pub tab_areas: Vec<Rect>,
    pub update_available: Option<String>,
    update_checker: UpdateChecker,
}

impl App {
    pub fn new() -> Result<Self> {
        let git = git::load_git_state()?;
        Ok(Self {
            tab: Tab::Status,
            git,
            selected: 0,
            scroll_offset: 0,
            tab_areas: Vec::new(),
            update_available: None,
            update_checker: UpdateChecker::spawn(),
        })
    }

    pub fn refresh(&mut self) -> Result<()> {
        self.git = git::load_git_state()?;
        if self.update_available.is_none() {
            if let Some(version) = self.update_checker.try_recv() {
                self.update_available = version;
            }
        }
        Ok(())
    }

    fn list_len(&self) -> usize {
        match self.tab {
            Tab::Status => self.git.files.len(),
            Tab::Branch => self.git.branches.len(),
            Tab::Log => self.git.log.len(),
        }
    }

    fn move_up(&mut self) {
        if self.selected > 0 {
            self.selected -= 1;
        }
    }

    fn move_down(&mut self) {
        let len = self.list_len();
        if len > 0 && self.selected < len - 1 {
            self.selected += 1;
        }
    }

    fn switch_tab(&mut self, tab: Tab) {
        if self.tab != tab {
            self.tab = tab;
            self.selected = 0;
            self.scroll_offset = 0;
        }
    }

    fn next_tab(&mut self) {
        let idx = (self.tab.index() + 1) % Tab::ALL.len();
        self.switch_tab(Tab::ALL[idx]);
    }

    fn prev_tab(&mut self) {
        let idx = if self.tab.index() == 0 {
            Tab::ALL.len() - 1
        } else {
            self.tab.index() - 1
        };
        self.switch_tab(Tab::ALL[idx]);
    }

    pub fn handle_key(&mut self, key: KeyEvent) -> AppEvent {
        // Ctrl+C or q to quit
        if key.code == KeyCode::Char('c') && key.modifiers.contains(KeyModifiers::CONTROL) {
            return AppEvent::Quit;
        }

        match key.code {
            KeyCode::Char('q') => AppEvent::Quit,
            KeyCode::Char('1') => {
                self.switch_tab(Tab::Status);
                AppEvent::Continue
            }
            KeyCode::Char('2') => {
                self.switch_tab(Tab::Branch);
                AppEvent::Continue
            }
            KeyCode::Char('3') => {
                self.switch_tab(Tab::Log);
                AppEvent::Continue
            }
            KeyCode::Tab => {
                self.next_tab();
                AppEvent::Continue
            }
            KeyCode::BackTab => {
                self.prev_tab();
                AppEvent::Continue
            }
            KeyCode::Up | KeyCode::Char('k') => {
                self.move_up();
                AppEvent::Continue
            }
            KeyCode::Down | KeyCode::Char('j') => {
                self.move_down();
                AppEvent::Continue
            }
            KeyCode::Char('r') => {
                let _ = self.refresh();
                AppEvent::Continue
            }
            _ => AppEvent::Continue,
        }
    }

    pub fn handle_mouse(&mut self, mouse: MouseEvent, _area: Rect) {
        match mouse.kind {
            MouseEventKind::Down(MouseButton::Left) => {
                // Check tab clicks
                for (i, tab_area) in self.tab_areas.iter().enumerate() {
                    if mouse.column >= tab_area.x
                        && mouse.column < tab_area.x + tab_area.width
                        && mouse.row >= tab_area.y
                        && mouse.row < tab_area.y + tab_area.height
                    {
                        self.switch_tab(Tab::ALL[i]);
                        return;
                    }
                }

                // Check list item clicks (content area starts at row 2)
                let content_start_row = 2;
                if mouse.row >= content_start_row {
                    let clicked_index =
                        (mouse.row - content_start_row) as usize + self.scroll_offset;
                    if clicked_index < self.list_len() {
                        self.selected = clicked_index;
                    }
                }
            }
            MouseEventKind::ScrollUp => self.move_up(),
            MouseEventKind::ScrollDown => self.move_down(),
            _ => {}
        }
    }
}
