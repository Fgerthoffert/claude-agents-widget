use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, WindowEvent,
};

// The one place this crate holds real behaviour rather than plumbing, and macOS-only by nature
// (ADR-0010): the panel is converted to a non-activating NSPanel so it can be drawn into another
// app's full-screen Space.
#[cfg(target_os = "macos")]
mod floating_panel;

/// Toggles the floating panel's visibility.
fn toggle_panel(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// Keep this layer thin (ADR-0002): tray plumbing and window visibility only.
// Application logic belongs in src/ (TypeScript).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // Detection core: FS watching of ~/.claude-agents-widget/sessions and `ps` for the
        // process scanner. Both are scoped in capabilities/default.json.
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        // UI surfaces: panel geometry persistence, Quit from the TypeScript tray menu, and
        // launch at login (opt-in, toggled from the tray).
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));

    // Both the plugin and the command it backs are macOS-only, so the registration is too.
    #[cfg(target_os = "macos")]
    let builder = builder
        .plugin(tauri_nspanel::init())
        .invoke_handler(tauri::generate_handler![
            floating_panel::float_panel_above_full_screen
        ]);

    builder
        .setup(|app| {
            // Menu-bar-only app: no Dock icon, never takes over as the active app.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // After the activation policy and before the tray, so the panel is already an
            // NSPanel by the time anything can reveal it.
            #[cfg(target_os = "macos")]
            floating_panel::convert(app.handle())?;

            let toggle = MenuItem::with_id(app, "toggle", "Show/Hide Panel", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle, &quit])?;

            let icon = app
                .default_window_icon()
                .expect("bundle always provides a default window icon")
                .clone();

            // `with_id` is the handle the TypeScript layer looks the tray up by
            // (`TrayIcon.getById('main')` in src/ui/useTray.ts) to set the live label and the
            // session dropdown. This Rust menu is the fallback that keeps Quit reachable if
            // the webview never loads.
            TrayIconBuilder::with_id("main")
                .icon(icon)
                // Template rendering lets macOS tint the icon for light/dark menu bars.
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => toggle_panel(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the panel hides it; the app lives in the menu bar until Quit.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
