use ratatui::{
    Frame,
    layout::{Constraint, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, List, ListItem, ListState, Padding, Wrap},
};

use crate::app::{App, Tab};
use crate::git::{StagedStatus, UnstagedStatus};
use crate::review::ReviewState;

const ACCENT: Color = Color::Blue;
const STAGED_COLOR: Color = Color::Green;
const UNSTAGED_COLOR: Color = Color::Yellow;
const UNTRACKED_COLOR: Color = Color::Red;
const DIM: Color = Color::Gray;

pub fn draw(f: &mut Frame, app: &mut App) {
    let area = f.area();

    let layout = Layout::vertical([
        Constraint::Length(1), // tabs
        Constraint::Length(1), // separator
        Constraint::Min(1),   // content
        Constraint::Length(1), // footer
    ])
    .split(area);

    draw_tabs(f, app, layout[0]);
    draw_separator(f, layout[1]);

    if app.detail.is_some() {
        draw_detail(f, app, layout[2]);
        draw_detail_footer(f, layout[3]);
    } else {
        match app.tab {
            Tab::Status => draw_status(f, app, layout[2]),
            Tab::Branch => draw_branches(f, app, layout[2]),
            Tab::Log => draw_log(f, app, layout[2]),
            Tab::Review => draw_review(f, app, layout[2]),
            Tab::Settings => draw_settings(f, app, layout[2]),
        }
        draw_footer(f, app, layout[3]);
    }
}

fn draw_tabs(f: &mut Frame, app: &mut App, area: Rect) {
    app.tab_areas.clear();
    let mut spans = Vec::new();
    let mut x = area.x + 1;

    for (i, tab) in app.visible_tabs.iter().enumerate() {
        let label = format!(" {} ", tab.label());
        let width = label.len() as u16;

        app.tab_areas.push(Rect::new(x, area.y, width, 1));

        let style = if *tab == app.tab {
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD | Modifier::REVERSED)
        } else {
            Style::default().fg(DIM)
        };

        spans.push(Span::styled(label, style));

        if i < app.visible_tabs.len() - 1 {
            spans.push(Span::raw(" "));
            x += width + 1;
        } else {
            x += width;
        }
    }

    let _ = x; // suppress unused warning
    let line = Line::from(spans);
    f.render_widget(
        ratatui::widgets::Paragraph::new(line).block(
            Block::default().padding(Padding::horizontal(0)),
        ),
        area,
    );
}

fn draw_separator(f: &mut Frame, area: Rect) {
    let line = "─".repeat(area.width as usize);
    f.render_widget(
        ratatui::widgets::Paragraph::new(line).style(Style::default().fg(DIM)),
        area,
    );
}

fn draw_status(f: &mut Frame, app: &mut App, area: Rect) {
    if app.git.files.is_empty() {
        let msg = ratatui::widgets::Paragraph::new(" Nothing to commit, working tree clean")
            .style(Style::default().fg(DIM));
        f.render_widget(msg, area);
        return;
    }

    let items: Vec<ListItem> = app
        .git
        .files
        .iter()
        .map(|file| {
            let (indicator, color) = match (&file.staged, &file.unstaged) {
                (StagedStatus::None, UnstagedStatus::Untracked) => ("?", UNTRACKED_COLOR),
                (StagedStatus::None, UnstagedStatus::Modified) => ("M", UNSTAGED_COLOR),
                (StagedStatus::None, UnstagedStatus::Deleted) => ("D", UNSTAGED_COLOR),
                (StagedStatus::New, UnstagedStatus::None) => ("A", STAGED_COLOR),
                (StagedStatus::Modified, UnstagedStatus::None) => ("M", STAGED_COLOR),
                (StagedStatus::Deleted, UnstagedStatus::None) => ("D", STAGED_COLOR),
                (StagedStatus::Renamed, UnstagedStatus::None) => ("R", STAGED_COLOR),
                (StagedStatus::New, _) => ("A", STAGED_COLOR),
                (StagedStatus::Modified, _) => ("M", UNSTAGED_COLOR),
                _ => ("~", DIM),
            };

            let line = Line::from(vec![
                Span::styled(format!(" {indicator} "), Style::default().fg(color)),
                Span::styled(&file.path, Style::default()),
            ]);

            ListItem::new(line)
        })
        .collect();

    let list = List::new(items).highlight_style(
        Style::default()
            .add_modifier(Modifier::BOLD | Modifier::REVERSED),
    );

    let mut state = ListState::default().with_selected(Some(app.selected));
    f.render_stateful_widget(list, area, &mut state);
}

fn draw_branches(f: &mut Frame, app: &mut App, area: Rect) {
    let items: Vec<ListItem> = app
        .git
        .branches
        .iter()
        .map(|branch| {
            let prefix = if branch.is_head { "* " } else { "  " };
            let name_color = if branch.is_head { ACCENT } else { Color::White };

            let mut spans = vec![
                Span::styled(prefix, Style::default().fg(name_color)),
                Span::styled(&branch.name, Style::default().fg(name_color)),
            ];

            if branch.ahead > 0 || branch.behind > 0 {
                let sync = format!(
                    " {}{}",
                    if branch.ahead > 0 {
                        format!("↑{}", branch.ahead)
                    } else {
                        String::new()
                    },
                    if branch.behind > 0 {
                        format!("↓{}", branch.behind)
                    } else {
                        String::new()
                    }
                );
                spans.push(Span::styled(sync, Style::default().fg(UNSTAGED_COLOR)));
            }

            ListItem::new(Line::from(spans))
        })
        .collect();

    let list = List::new(items).highlight_style(
        Style::default()
            .add_modifier(Modifier::BOLD | Modifier::REVERSED),
    );

    let mut state = ListState::default().with_selected(Some(app.selected));
    f.render_stateful_widget(list, area, &mut state);
}

fn draw_log(f: &mut Frame, app: &mut App, area: Rect) {
    let items: Vec<ListItem> = app
        .git
        .log
        .iter()
        .map(|commit| {
            let short_hash = &commit.hash[..7.min(commit.hash.len())];
            let mut spans = vec![
                Span::styled(
                    format!(" {short_hash} "),
                    Style::default().fg(ACCENT),
                ),
                Span::styled(&commit.message, Style::default()),
            ];
            if let Some(tag) = &commit.tag {
                spans.push(Span::styled(
                    format!(" {tag}"),
                    Style::default().fg(Color::Yellow),
                ));
            }
            spans.push(Span::styled(
                format!("  {} ", &commit.time),
                Style::default().fg(DIM),
            ));
            let line = Line::from(spans);
            ListItem::new(line)
        })
        .collect();

    let list = List::new(items).highlight_style(
        Style::default()
            .add_modifier(Modifier::BOLD | Modifier::REVERSED),
    );

    let mut state = ListState::default().with_selected(Some(app.selected));
    f.render_stateful_widget(list, area, &mut state);
}

fn draw_review(f: &mut Frame, app: &mut App, area: Rect) {
    let mut lines: Vec<Line> = Vec::new();
    let is_main = app.git.head_branch == "main" || app.git.head_branch == "master";
    let is_detached = app.git.head_branch.contains("detached");
    let can_review = !is_main && !is_detached;

    // Branch info
    if is_detached {
        lines.push(Line::from(Span::styled(
            " HEAD is detached",
            Style::default().fg(UNSTAGED_COLOR),
        )));
        lines.push(Line::from(Span::styled(
            " Checkout a branch to use review",
            Style::default().fg(DIM),
        )));
    } else if is_main {
        lines.push(Line::from(Span::styled(
            format!(" On {} branch", app.git.head_branch),
            Style::default().fg(DIM),
        )));
        lines.push(Line::from(Span::styled(
            " Switch to a feature branch to use review",
            Style::default().fg(DIM),
        )));
    } else {
        lines.push(Line::from(Span::styled(
            format!(" Branch: {}", app.git.head_branch),
            Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
        )));
    }

    if can_review {
        // Separator
        lines.push(Line::from(""));
        lines.push(Line::from(Span::styled(
            " ".to_string() + &"─".repeat(area.width.saturating_sub(2) as usize),
            Style::default().fg(DIM),
        )));
        lines.push(Line::from(""));

        // Review section
        let tool_label = if app.config.review_tool == "codex" { "Codex" } else { "Claude" };

        match &app.review_state {
            ReviewState::Idle => {
                lines.push(Line::from(Span::styled(
                    format!(" Press Enter or r to review with {tool_label}"),
                    Style::default().fg(DIM),
                )));
            }
            ReviewState::Running => {
                let mode_label = app.review_mode.as_ref().map(|m| m.label()).unwrap_or("...");
                lines.push(Line::from(Span::styled(
                    format!(" ⏳ Reviewing {mode_label} with {tool_label}..."),
                    Style::default().fg(ACCENT),
                )));
            }
            ReviewState::Done(text) => {
                let mode_label = app.review_mode.as_ref().map(|m| m.label()).unwrap_or("");
                lines.push(Line::from(Span::styled(
                    format!(" Review ({tool_label} · {mode_label})"),
                    Style::default().fg(ACCENT).add_modifier(Modifier::BOLD),
                )));
                lines.push(Line::from(""));
                if text.trim().is_empty() {
                    lines.push(Line::from(Span::styled(
                        " No issues found.",
                        Style::default().fg(STAGED_COLOR),
                    )));
                } else {
                    for line in text.lines() {
                        lines.push(Line::from(Span::styled(
                            format!(" {line}"),
                            Style::default(),
                        )));
                    }
                }
            }
            ReviewState::Error(err) => {
                lines.push(Line::from(Span::styled(
                    format!(" ✗ {err}"),
                    Style::default().fg(UNTRACKED_COLOR),
                )));
                lines.push(Line::from(""));
                lines.push(Line::from(Span::styled(
                    " Press Enter to retry",
                    Style::default().fg(DIM),
                )));
            }
        }
    }

    // Render with scroll
    let visible_height = area.height as usize;
    let max_scroll = lines.len().saturating_sub(visible_height);
    app.review_scroll = app.review_scroll.min(max_scroll);

    let visible_lines: Vec<Line> = lines
        .into_iter()
        .skip(app.review_scroll)
        .take(visible_height)
        .collect();

    let paragraph = ratatui::widgets::Paragraph::new(visible_lines)
        .wrap(Wrap { trim: false });
    f.render_widget(paragraph, area);
}

fn draw_settings(f: &mut Frame, app: &mut App, area: Rect) {
    use crate::app::SettingsCursor;

    let rows = app.settings_flat_rows();
    let cursor_idx = app.settings_cursor_index();

    let items: Vec<ListItem> = rows
        .iter()
        .map(|row| match row {
            SettingsCursor::Group(gi) => {
                let group = &app.settings_groups[*gi];
                let arrow = if group.expanded { "▼" } else { "▶" };
                let line = Line::from(vec![
                    Span::styled(format!(" {arrow} "), Style::default().fg(ACCENT)),
                    Span::styled(
                        &group.label,
                        Style::default().add_modifier(Modifier::BOLD),
                    ),
                ]);
                ListItem::new(line)
            }
            SettingsCursor::Item(gi, ii) => {
                let item = &app.settings_groups[*gi].items[*ii];
                let toggle = if item.enabled { "●" } else { "○" };
                let toggle_color = if item.enabled { STAGED_COLOR } else { DIM };
                let line = Line::from(vec![
                    Span::styled(format!("   {toggle} "), Style::default().fg(toggle_color)),
                    Span::styled(&item.label, Style::default()),
                ]);
                ListItem::new(line)
            }
        })
        .collect();

    let list = List::new(items).highlight_style(
        Style::default()
            .add_modifier(Modifier::BOLD | Modifier::REVERSED),
    );

    let mut state = ListState::default().with_selected(Some(cursor_idx));
    f.render_stateful_widget(list, area, &mut state);
}

fn draw_detail(f: &mut Frame, app: &mut App, area: Rect) {
    let detail = match &app.detail {
        Some(d) => d,
        None => return,
    };

    let mut lines: Vec<Line> = Vec::new();

    // Header
    lines.push(Line::from(vec![
        Span::styled(" commit ", Style::default().fg(DIM)),
        Span::styled(&detail.hash, Style::default().fg(ACCENT)),
    ]));
    lines.push(Line::from(vec![
        Span::styled(" author ", Style::default().fg(DIM)),
        Span::styled(&detail.author, Style::default()),
        Span::styled(format!(" <{}>", &detail.email), Style::default().fg(DIM)),
    ]));
    lines.push(Line::from(vec![
        Span::styled(" date   ", Style::default().fg(DIM)),
        Span::styled(&detail.time, Style::default()),
    ]));
    lines.push(Line::from(""));

    // Message
    for msg_line in detail.message.lines() {
        lines.push(Line::from(Span::styled(
            format!("   {msg_line}"),
            Style::default(),
        )));
    }
    lines.push(Line::from(""));

    // Separator
    lines.push(Line::from(Span::styled(
        format!(" {} file(s) changed", detail.files.len()),
        Style::default().fg(DIM),
    )));
    lines.push(Line::from(""));

    // Files
    for file in &detail.files {
        let status_color = match file.status {
            'A' => STAGED_COLOR,
            'D' => UNTRACKED_COLOR,
            'M' => UNSTAGED_COLOR,
            _ => DIM,
        };
        let mut spans = vec![
            Span::styled(format!(" {} ", file.status), Style::default().fg(status_color)),
            Span::styled(&file.path, Style::default()),
        ];
        if file.additions > 0 || file.deletions > 0 {
            spans.push(Span::raw(" "));
            if file.additions > 0 {
                spans.push(Span::styled(
                    format!("+{}", file.additions),
                    Style::default().fg(STAGED_COLOR),
                ));
            }
            if file.deletions > 0 {
                spans.push(Span::styled(
                    format!("-{}", file.deletions),
                    Style::default().fg(UNTRACKED_COLOR),
                ));
            }
        }
        lines.push(Line::from(spans));
    }

    // Apply scroll
    let visible_height = area.height as usize;
    let max_scroll = lines.len().saturating_sub(visible_height);
    app.detail_scroll = app.detail_scroll.min(max_scroll);

    let visible_lines: Vec<Line> = lines
        .into_iter()
        .skip(app.detail_scroll)
        .take(visible_height)
        .collect();

    let paragraph = ratatui::widgets::Paragraph::new(visible_lines)
        .wrap(Wrap { trim: false });
    f.render_widget(paragraph, area);
}

fn draw_detail_footer(f: &mut Frame, area: Rect) {
    let spans = vec![
        Span::styled(" Esc", Style::default().fg(ACCENT)),
        Span::styled(" back", Style::default().fg(DIM)),
        Span::styled("  j/k", Style::default().fg(ACCENT)),
        Span::styled(" scroll", Style::default().fg(DIM)),
    ];
    let footer = ratatui::widgets::Paragraph::new(Line::from(spans))
        .style(Style::default().add_modifier(Modifier::DIM));
    f.render_widget(footer, area);
}

fn draw_footer(f: &mut Frame, app: &App, area: Rect) {
    let branch = &app.git.head_branch;
    let staged = app.git.staged_count();
    let unstaged = app.git.unstaged_count();
    let untracked = app.git.untracked_count();

    let mut spans = vec![
        Span::styled(format!(" {branch}"), Style::default().fg(ACCENT)),
    ];

    if staged > 0 || unstaged > 0 || untracked > 0 {
        spans.push(Span::styled("  ", Style::default().fg(DIM)));
        if staged > 0 {
            spans.push(Span::styled(
                format!("+{staged}"),
                Style::default().fg(STAGED_COLOR),
            ));
            spans.push(Span::raw(" "));
        }
        if unstaged > 0 {
            spans.push(Span::styled(
                format!("~{unstaged}"),
                Style::default().fg(UNSTAGED_COLOR),
            ));
            spans.push(Span::raw(" "));
        }
        if untracked > 0 {
            spans.push(Span::styled(
                format!("?{untracked}"),
                Style::default().fg(UNTRACKED_COLOR),
            ));
        }
    }

    if app.tab == Tab::Review {
        let is_main = app.git.head_branch == "main" || app.git.head_branch == "master";
        let is_detached = app.git.head_branch.contains("detached");
        if !is_main && !is_detached {
            match &app.review_state {
                ReviewState::Idle | ReviewState::Error(_) => {
                    spans.push(Span::styled("  Enter", Style::default().fg(ACCENT)));
                    spans.push(Span::styled(" review changes", Style::default().fg(DIM)));
                }
                ReviewState::Running => {
                    spans.push(Span::styled("  reviewing...", Style::default().fg(DIM)));
                }
                ReviewState::Done(_) => {
                    // Show copy feedback or normal hints
                    let show_copied = app.copy_feedback
                        .map(|t| t.elapsed().as_secs() < 2)
                        .unwrap_or(false);

                    if show_copied {
                        spans.push(Span::styled("  ✓ Copied", Style::default().fg(STAGED_COLOR)));
                    } else {
                        spans.push(Span::styled("  y", Style::default().fg(ACCENT)));
                        spans.push(Span::styled(" copy", Style::default().fg(DIM)));
                    }
                    spans.push(Span::styled("  r", Style::default().fg(ACCENT)));
                    spans.push(Span::styled(" re-review", Style::default().fg(DIM)));
                    spans.push(Span::styled("  j/k", Style::default().fg(ACCENT)));
                    spans.push(Span::styled(" scroll", Style::default().fg(DIM)));
                }
            }
        }
    }

    if let Some(version) = &app.update_available {
        spans.push(Span::styled(
            format!("  ↑ v{version}"),
            Style::default().fg(Color::Magenta),
        ));
    }

    let footer = ratatui::widgets::Paragraph::new(Line::from(spans))
        .style(Style::default().add_modifier(Modifier::DIM));
    f.render_widget(footer, area);
}
