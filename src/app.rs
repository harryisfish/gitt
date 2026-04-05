use anyhow::Result;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, MouseButton, MouseEvent, MouseEventKind};
use ratatui::layout::Rect;

use crate::config::Config;
use crate::git::{self, CommitDetail, GitState};
use crate::review::{self, ReviewState};
use crate::update::UpdateChecker;
use std::sync::mpsc;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Tab {
    Status,
    Branch,
    Log,
    Review,
    Settings,
}

impl Tab {
    pub fn label(&self) -> &str {
        match self {
            Tab::Status => "Status",
            Tab::Branch => "Branch",
            Tab::Log => "Log",
            Tab::Review => "Review",
            Tab::Settings => "Settings",
        }
    }
}

pub enum AppEvent {
    Quit,
    Continue,
}

// Settings menu: groups with toggleable children
#[derive(Debug, Clone)]
pub struct SettingsGroup {
    pub label: String,
    pub expanded: bool,
    pub items: Vec<SettingsToggle>,
}

#[derive(Debug, Clone)]
pub struct SettingsToggle {
    pub key: String,
    pub label: String,
    pub enabled: bool,
}

// A flat index into the settings menu
#[derive(Debug, Clone, Copy)]
pub enum SettingsCursor {
    Group(usize),
    Item(usize, usize), // (group_idx, item_idx)
}

pub struct App {
    pub config: Config,
    pub visible_tabs: Vec<Tab>,
    pub tab: Tab,
    pub git: GitState,
    pub selected: usize,
    pub scroll_offset: usize,
    pub tab_areas: Vec<Rect>,
    pub update_available: Option<String>,
    pub detail: Option<CommitDetail>,
    pub detail_scroll: usize,
    pub review_state: ReviewState,
    pub review_scroll: usize,
    review_rx: Option<mpsc::Receiver<ReviewState>>,
    review_branch: String,
    pub settings_groups: Vec<SettingsGroup>,
    pub settings_cursor: SettingsCursor,
    update_checker: UpdateChecker,
}

impl App {
    pub fn new() -> Result<Self> {
        let config = Config::load();
        let git = git::load_git_state()?;
        let update_checker = if config.auto_update_check {
            UpdateChecker::spawn()
        } else {
            UpdateChecker::disabled()
        };
        let visible_tabs = Self::build_visible_tabs(&config);
        let tab = visible_tabs.first().copied().unwrap_or(Tab::Status);
        let settings_groups = Self::build_settings_groups(&config);

        let head_branch = git.head_branch.clone();

        Ok(Self {
            config,
            visible_tabs,
            tab,
            git,
            selected: 0,
            scroll_offset: 0,
            tab_areas: Vec::new(),
            update_available: None,
            detail: None,
            detail_scroll: 0,
            review_state: ReviewState::Idle,
            review_scroll: 0,
            review_rx: None,
            review_branch: head_branch,
            settings_groups,
            settings_cursor: SettingsCursor::Group(0),
            update_checker,
        })
    }

    fn build_visible_tabs(config: &Config) -> Vec<Tab> {
        let mut tabs = Vec::new();
        if config.tabs.status { tabs.push(Tab::Status); }
        if config.tabs.branch { tabs.push(Tab::Branch); }
        if config.tabs.log { tabs.push(Tab::Log); }
        if config.tabs.review { tabs.push(Tab::Review); }
        tabs.push(Tab::Settings);
        tabs
    }

    fn build_settings_groups(config: &Config) -> Vec<SettingsGroup> {
        vec![
            SettingsGroup {
                label: "Tabs".into(),
                expanded: false,
                items: vec![
                    SettingsToggle { key: "tab.status".into(), label: "Status".into(), enabled: config.tabs.status },
                    SettingsToggle { key: "tab.branch".into(), label: "Branch".into(), enabled: config.tabs.branch },
                    SettingsToggle { key: "tab.log".into(), label: "Log".into(), enabled: config.tabs.log },
                    SettingsToggle { key: "tab.review".into(), label: "Review".into(), enabled: config.tabs.review },
                ],
            },
            SettingsGroup {
                label: "Review".into(),
                expanded: false,
                items: vec![
                    SettingsToggle {
                        key: "review.tool".into(),
                        label: format!("Tool: {}", if config.review_tool == "codex" { "Codex" } else { "Claude" }),
                        enabled: config.review_tool == "codex",
                    },
                    SettingsToggle { key: "review.auto".into(), label: "Auto review".into(), enabled: config.auto_review },
                ],
            },
            SettingsGroup {
                label: "General".into(),
                expanded: false,
                items: vec![
                    SettingsToggle { key: "mouse".into(), label: "Mouse support".into(), enabled: config.mouse_enabled },
                    SettingsToggle { key: "auto_update".into(), label: "Auto update check".into(), enabled: config.auto_update_check },
                ],
            },
        ]
    }

    fn apply_toggle(&mut self, group_idx: usize, item_idx: usize) {
        let item = &mut self.settings_groups[group_idx].items[item_idx];
        item.enabled = !item.enabled;
        let new_val = item.enabled;
        let key = item.key.clone();

        match key.as_str() {
            "tab.status" => self.config.tabs.status = new_val,
            "tab.branch" => self.config.tabs.branch = new_val,
            "tab.log" => self.config.tabs.log = new_val,
            "tab.review" => self.config.tabs.review = new_val,
            "review.tool" => {
                self.config.review_tool = if new_val { "codex".into() } else { "claude".into() };
                self.settings_groups[group_idx].items[item_idx].label =
                    if new_val { "Tool: Codex".into() } else { "Tool: Claude".into() };
            }
            "review.auto" => self.config.auto_review = new_val,
            "mouse" => self.config.mouse_enabled = new_val,
            "auto_update" => self.config.auto_update_check = new_val,
            _ => {}
        }

        self.visible_tabs = Self::build_visible_tabs(&self.config);
        let _ = self.config.save();
    }

    // Get a flat list of visible rows for settings navigation
    pub fn settings_flat_rows(&self) -> Vec<SettingsCursor> {
        let mut rows = Vec::new();
        for (gi, group) in self.settings_groups.iter().enumerate() {
            rows.push(SettingsCursor::Group(gi));
            if group.expanded {
                for ii in 0..group.items.len() {
                    rows.push(SettingsCursor::Item(gi, ii));
                }
            }
        }
        rows
    }

    pub fn settings_cursor_index(&self) -> usize {
        let rows = self.settings_flat_rows();
        rows.iter().position(|r| match (r, &self.settings_cursor) {
            (SettingsCursor::Group(a), SettingsCursor::Group(b)) => a == b,
            (SettingsCursor::Item(a1, a2), SettingsCursor::Item(b1, b2)) => a1 == b1 && a2 == b2,
            _ => false,
        }).unwrap_or(0)
    }

    fn settings_move_up(&mut self) {
        let rows = self.settings_flat_rows();
        let idx = self.settings_cursor_index();
        if idx > 0 {
            self.settings_cursor = rows[idx - 1];
        }
    }

    fn settings_move_down(&mut self) {
        let rows = self.settings_flat_rows();
        let idx = self.settings_cursor_index();
        if idx + 1 < rows.len() {
            self.settings_cursor = rows[idx + 1];
        }
    }

    fn settings_right(&mut self) {
        match self.settings_cursor {
            SettingsCursor::Group(gi) => {
                // Expand and move cursor to first child
                self.settings_groups[gi].expanded = true;
                if !self.settings_groups[gi].items.is_empty() {
                    self.settings_cursor = SettingsCursor::Item(gi, 0);
                }
            }
            SettingsCursor::Item(gi, ii) => {
                // Toggle on item
                self.apply_toggle(gi, ii);
            }
        }
    }

    fn settings_left(&mut self) {
        match self.settings_cursor {
            SettingsCursor::Item(gi, _) => {
                // Go back to parent group
                self.settings_cursor = SettingsCursor::Group(gi);
            }
            SettingsCursor::Group(gi) => {
                // Collapse if expanded
                self.settings_groups[gi].expanded = false;
            }
        }
    }

    fn settings_enter(&mut self) {
        match self.settings_cursor {
            SettingsCursor::Group(gi) => {
                self.settings_groups[gi].expanded = !self.settings_groups[gi].expanded;
                if self.settings_groups[gi].expanded && !self.settings_groups[gi].items.is_empty() {
                    self.settings_cursor = SettingsCursor::Item(gi, 0);
                }
            }
            SettingsCursor::Item(gi, ii) => {
                self.apply_toggle(gi, ii);
            }
        }
    }

    pub fn refresh(&mut self) -> Result<()> {
        self.git = git::load_git_state()?;

        // Reset review state when branch changes
        if self.git.head_branch != self.review_branch {
            self.review_state = ReviewState::Idle;
            self.review_scroll = 0;
            self.review_rx = None;
            self.review_branch = self.git.head_branch.clone();
        }

        // Check for review results
        if let Some(rx) = &self.review_rx {
            if let Ok(state) = rx.try_recv() {
                self.review_state = state;
                self.review_rx = None;
            }
        }

        if self.update_available.is_none() {
            if let Some(version) = self.update_checker.try_recv() {
                self.update_available = version;
            }
        }
        Ok(())
    }

    pub fn trigger_review(&mut self) {
        if matches!(self.review_state, ReviewState::Running) {
            return;
        }

        if self.git.head_branch.contains("detached") {
            self.review_state = ReviewState::Error("HEAD is detached, checkout a branch first".into());
            return;
        }

        let is_main = self.git.head_branch == "main" || self.git.head_branch == "master";
        if is_main {
            self.review_state = ReviewState::Error("On main branch, switch to a feature branch".into());
            return;
        }

        let base = self.detect_base_branch();

        self.review_state = ReviewState::Running;
        self.review_scroll = 0;
        self.review_rx = Some(review::start_review(&self.config.review_tool, &base));
    }

    fn detect_base_branch(&self) -> String {
        for branch in &self.git.branches {
            if branch.name == "main" {
                return "main".to_string();
            }
        }
        for branch in &self.git.branches {
            if branch.name == "master" {
                return "master".to_string();
            }
        }
        "main".to_string()
    }

    pub fn list_len(&self) -> usize {
        match self.tab {
            Tab::Status => self.git.files.len(),
            Tab::Branch => self.git.branches.len(),
            Tab::Log => self.git.log.len(),
            Tab::Review => 0,
            Tab::Settings => self.settings_flat_rows().len(),
        }
    }

    fn move_up(&mut self) {
        if self.tab == Tab::Settings {
            self.settings_move_up();
        } else if self.tab == Tab::Review {
            self.review_scroll = self.review_scroll.saturating_sub(1);
        } else if self.selected > 0 {
            self.selected -= 1;
        }
    }

    fn move_down(&mut self) {
        if self.tab == Tab::Settings {
            self.settings_move_down();
        } else if self.tab == Tab::Review {
            self.review_scroll += 1;
        } else {
            let len = self.list_len();
            if len > 0 && self.selected < len - 1 {
                self.selected += 1;
            }
        }
    }

    fn switch_tab(&mut self, tab: Tab) {
        if self.tab != tab {
            self.tab = tab;
            self.selected = 0;
            self.scroll_offset = 0;

            // Auto-trigger review when switching to PR tab
            if tab == Tab::Review
                && self.config.auto_review
                && matches!(self.review_state, ReviewState::Idle)
            {
                self.trigger_review();
            }
        }
    }

    fn current_tab_index(&self) -> Option<usize> {
        self.visible_tabs.iter().position(|t| *t == self.tab)
    }

    fn next_tab(&mut self) {
        if let Some(idx) = self.current_tab_index() {
            let next = (idx + 1) % self.visible_tabs.len();
            self.switch_tab(self.visible_tabs[next]);
        }
    }

    fn prev_tab(&mut self) {
        if let Some(idx) = self.current_tab_index() {
            let prev = if idx == 0 { self.visible_tabs.len() - 1 } else { idx - 1 };
            self.switch_tab(self.visible_tabs[prev]);
        }
    }

    fn open_detail(&mut self) {
        if self.tab == Tab::Log {
            if let Some(commit) = self.git.log.get(self.selected) {
                if let Ok(detail) = git::get_commit_detail(&commit.hash) {
                    self.detail = Some(detail);
                    self.detail_scroll = 0;
                }
            }
        }
    }

    fn close_detail(&mut self) {
        self.detail = None;
        self.detail_scroll = 0;
    }

    pub fn handle_key(&mut self, key: KeyEvent) -> AppEvent {
        if key.code == KeyCode::Char('c') && key.modifiers.contains(KeyModifiers::CONTROL) {
            return AppEvent::Quit;
        }

        // Detail view mode
        if self.detail.is_some() {
            match key.code {
                KeyCode::Esc | KeyCode::Left | KeyCode::Char('h') => self.close_detail(),
                KeyCode::Up | KeyCode::Char('k') => {
                    self.detail_scroll = self.detail_scroll.saturating_sub(1);
                }
                KeyCode::Down | KeyCode::Char('j') => {
                    self.detail_scroll += 1;
                }
                _ => {}
            }
            return AppEvent::Continue;
        }

        // Settings tab
        if self.tab == Tab::Settings {
            match key.code {
                KeyCode::Enter | KeyCode::Char(' ') => self.settings_enter(),
                KeyCode::Up | KeyCode::Char('k') => self.move_up(),
                KeyCode::Down | KeyCode::Char('j') => self.move_down(),
                KeyCode::Right | KeyCode::Char('l') => self.settings_right(),
                KeyCode::Left | KeyCode::Char('h') => self.settings_left(),
                KeyCode::Tab => self.next_tab(),
                KeyCode::BackTab => self.prev_tab(),
                KeyCode::Char(c @ '1'..='9') => {
                    let idx = (c as usize) - ('1' as usize);
                    if idx < self.visible_tabs.len() {
                        self.switch_tab(self.visible_tabs[idx]);
                    }
                }
                _ => {}
            }
            return AppEvent::Continue;
        }

        match key.code {
            KeyCode::Enter | KeyCode::Right | KeyCode::Char('l') => {
                if self.tab == Tab::Review {
                    self.trigger_review();
                } else {
                    self.open_detail();
                }
                AppEvent::Continue
            }
            KeyCode::Char(c @ '1'..='9') => {
                let idx = (c as usize) - ('1' as usize);
                if idx < self.visible_tabs.len() {
                    self.switch_tab(self.visible_tabs[idx]);
                }
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
                if self.tab == Tab::Review {
                    self.trigger_review();
                } else {
                    let _ = self.refresh();
                }
                AppEvent::Continue
            }
            _ => AppEvent::Continue,
        }
    }

    pub fn handle_mouse(&mut self, mouse: MouseEvent, _area: Rect) {
        match mouse.kind {
            MouseEventKind::Down(MouseButton::Left) => {
                for (i, tab_area) in self.tab_areas.iter().enumerate() {
                    if mouse.column >= tab_area.x
                        && mouse.column < tab_area.x + tab_area.width
                        && mouse.row >= tab_area.y
                        && mouse.row < tab_area.y + tab_area.height
                    {
                        if i < self.visible_tabs.len() {
                            self.switch_tab(self.visible_tabs[i]);
                        }
                        return;
                    }
                }

                let content_start_row = 2;
                if mouse.row >= content_start_row {
                    let clicked_index =
                        (mouse.row - content_start_row) as usize + self.scroll_offset;

                    if self.tab == Tab::Settings {
                        let rows = self.settings_flat_rows();
                        if clicked_index < rows.len() {
                            self.settings_cursor = rows[clicked_index];
                            self.settings_enter();
                        }
                    } else if clicked_index < self.list_len() {
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
