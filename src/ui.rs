use ratatui::{
    Frame,
    layout::{Constraint, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, List, ListItem, ListState, Padding, Wrap},
};

use crate::app::{App, Tab};
use crate::git::{StagedStatus, UnstagedStatus};
use crate::github::GhStatus;

const ACCENT: Color = Color::Cyan;
const STAGED_COLOR: Color = Color::Green;
const UNSTAGED_COLOR: Color = Color::Yellow;
const UNTRACKED_COLOR: Color = Color::Red;
const DIM: Color = Color::DarkGray;

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
            Tab::PR => draw_prs(f, app, layout[2]),
        }
        draw_footer(f, app, layout[3]);
    }
}

fn draw_tabs(f: &mut Frame, app: &mut App, area: Rect) {
    app.tab_areas.clear();
    let mut spans = Vec::new();
    let mut x = area.x + 1;

    for (i, tab) in Tab::ALL.iter().enumerate() {
        let label = format!(" {} ", tab.label());
        let width = label.len() as u16;

        app.tab_areas.push(Rect::new(x, area.y, width, 1));

        let style = if *tab == app.tab {
            Style::default().fg(Color::Black).bg(ACCENT)
        } else {
            Style::default().fg(DIM)
        };

        spans.push(Span::styled(label, style));

        if i < Tab::ALL.len() - 1 {
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
                Span::styled(&file.path, Style::default().fg(Color::White)),
            ]);

            ListItem::new(line)
        })
        .collect();

    let list = List::new(items).highlight_style(
        Style::default()
            .bg(Color::DarkGray)
            .add_modifier(Modifier::BOLD),
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
            .bg(Color::DarkGray)
            .add_modifier(Modifier::BOLD),
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
                Span::styled(&commit.message, Style::default().fg(Color::White)),
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
            .bg(Color::DarkGray)
            .add_modifier(Modifier::BOLD),
    );

    let mut state = ListState::default().with_selected(Some(app.selected));
    f.render_stateful_widget(list, area, &mut state);
}

fn draw_prs(f: &mut Frame, app: &mut App, area: Rect) {
    match &app.gh_status {
        GhStatus::NotInstalled => {
            let msg = ratatui::widgets::Paragraph::new(" gh CLI not installed\n Run: brew install gh")
                .style(Style::default().fg(UNTRACKED_COLOR));
            f.render_widget(msg, area);
            return;
        }
        GhStatus::NotAuthenticated => {
            let msg = ratatui::widgets::Paragraph::new(" gh not authenticated\n Run: gh auth login")
                .style(Style::default().fg(UNSTAGED_COLOR));
            f.render_widget(msg, area);
            return;
        }
        GhStatus::Ready => {}
    }

    if app.prs.is_empty() {
        let msg = ratatui::widgets::Paragraph::new(" No open pull requests")
            .style(Style::default().fg(DIM));
        f.render_widget(msg, area);
        return;
    }

    let items: Vec<ListItem> = app
        .prs
        .iter()
        .map(|pr| {
            let checks_color = if pr.checks_status.contains("failed") {
                UNTRACKED_COLOR
            } else if pr.checks_status.contains("pending") {
                UNSTAGED_COLOR
            } else {
                STAGED_COLOR
            };

            let review_icon = match pr.review_decision.as_str() {
                "APPROVED" => Span::styled(" ✓", Style::default().fg(STAGED_COLOR)),
                "CHANGES_REQUESTED" => Span::styled(" ✗", Style::default().fg(UNTRACKED_COLOR)),
                "REVIEW_REQUIRED" => Span::styled(" ○", Style::default().fg(UNSTAGED_COLOR)),
                _ => Span::raw(""),
            };

            let line = Line::from(vec![
                Span::styled(
                    format!(" #{} ", pr.number),
                    Style::default().fg(ACCENT),
                ),
                Span::styled(&pr.title, Style::default().fg(Color::White)),
                review_icon,
                Span::styled(
                    format!(" [{}]", pr.checks_status),
                    Style::default().fg(checks_color),
                ),
                Span::styled(
                    format!(" +{}-{}", pr.additions, pr.deletions),
                    Style::default().fg(DIM),
                ),
            ]);

            ListItem::new(line)
        })
        .collect();

    let list = List::new(items).highlight_style(
        Style::default()
            .bg(Color::DarkGray)
            .add_modifier(Modifier::BOLD),
    );

    let mut state = ListState::default().with_selected(Some(app.selected));
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
        Span::styled(&detail.author, Style::default().fg(Color::White)),
        Span::styled(format!(" <{}>", &detail.email), Style::default().fg(DIM)),
    ]));
    lines.push(Line::from(vec![
        Span::styled(" date   ", Style::default().fg(DIM)),
        Span::styled(&detail.time, Style::default().fg(Color::White)),
    ]));
    lines.push(Line::from(""));

    // Message
    for msg_line in detail.message.lines() {
        lines.push(Line::from(Span::styled(
            format!("   {msg_line}"),
            Style::default().fg(Color::White),
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
            Span::styled(&file.path, Style::default().fg(Color::White)),
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
        .style(Style::default().bg(Color::Rgb(30, 30, 30)));
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

    if let Some(version) = &app.update_available {
        spans.push(Span::styled(
            format!("  ↑ v{version}"),
            Style::default().fg(Color::Magenta),
        ));
    }

    let footer = ratatui::widgets::Paragraph::new(Line::from(spans))
        .style(Style::default().bg(Color::Rgb(30, 30, 30)));
    f.render_widget(footer, area);
}
