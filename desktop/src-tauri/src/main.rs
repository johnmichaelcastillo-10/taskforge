// Taskforge desktop: the hosted app in a native window, plus what a browser tab can't do.
//
// - The tray shows the running timer and can stop it or bring the window back.
// - Notifications when a timer starts or stops, and when one has run for a long time.
// - Ctrl+Shift+Space brings the window to the front from anywhere.
// - Closing the window hides it to the tray; "Quit" in the tray menu exits.
//
// The web app talks to this shell through two commands (set_timer, notify) and listens for the
// "tray-stop-timer" event; see app/plugins/desktop.client.ts in the Nuxt app.

// No console window behind the app in release builds on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent, Wry,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_notification::NotificationExt;

/// The tray menu entries that change with the timer.
struct TrayItems {
    status: MenuItem<Wry>,
    stop: MenuItem<Wry>,
}

/// What the web app reports about its timer: the task being timed, or nothing.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TimerState {
    task_title: Option<String>,
}

#[tauri::command]
fn set_timer(app: AppHandle, items: State<'_, TrayItems>, timer: TimerState) -> Result<(), String> {
    let status = match &timer.task_title {
        Some(title) => format!("Timing: {title}"),
        None => "No timer running".to_string(),
    };
    items.status.set_text(&status).map_err(|error| error.to_string())?;
    items.stop.set_enabled(timer.task_title.is_some()).map_err(|error| error.to_string())?;
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_tooltip(Some(format!("Taskforge: {status}"))).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn notify(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|error| error.to_string())
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn main() {
    tauri::Builder::default()
        // Opening the app again focuses the running one instead of starting a second.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main_window(app)))
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        show_main_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let status = MenuItem::with_id(app, "status", "No timer running", false, None::<&str>)?;
            let stop = MenuItem::with_id(app, "stop", "Stop timer", false, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show Taskforge", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Taskforge", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&status, &stop, &separator, &show, &quit])?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().cloned().expect("the bundle has an icon"))
                .tooltip("Taskforge: no timer running")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "stop" => {
                        let _ = app.emit("tray-stop-timer", ());
                    }
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            app.manage(TrayItems { status, stop });

            // Another app may already own the shortcut; the rest still works without it.
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
            if let Err(error) = app.global_shortcut().register(shortcut) {
                eprintln!("Ctrl+Shift+Space is unavailable: {error}");
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing hides to the tray, so the timer stays one click away.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![set_timer, notify])
        .run(tauri::generate_context!())
        .expect("Taskforge failed to start");
}
