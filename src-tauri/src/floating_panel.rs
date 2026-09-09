//! Makes the panel float above other apps' native full-screen Spaces (macOS only).
//!
//! ADR-0010 measured why this cannot be done with flags alone: `FullScreenAuxiliary` and
//! `NSStatusWindowLevel` on `tao`'s own `NSWindow` are a no-op, and re-pointing the isa at a
//! plain `NSPanel` breaks rendering because `tao`'s `TaoWindow` subclass owns the
//! `canBecomeKeyWindow` override the WKWebView needs. `tauri-nspanel` is the `NSPanel` subclass
//! that keeps that override, so the conversion goes through it.
//!
//! This is the escape hatch ADR-0002 reserves for Rust: none of it is reachable from TypeScript.
//! TypeScript still decides *when* to re-assert (`src/ui/floatPanelAboveFullScreen.ts`).

use tauri::{AppHandle, Manager, Wry};
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt, PanelHandle, PanelLevel, StyleMask,
    WebviewWindowExt,
};

/// Must match the window label in `tauri.conf.json`.
const PANEL_LABEL: &str = "main";

tauri_panel! {
    panel!(FloatingPanel {
        config: {
            // The override a bare `object_setClass` would discard: without it a borderless
            // NSPanel refuses to become key and the webview never paints (ADR-0010).
            can_become_key_window: true,
            is_floating_panel: true
        }
    })
}

/// Applies the three window properties that put the panel into a full-screen Space.
///
/// Style mask and collection behaviour are read-modify-write: the mask carries `Resizable` from
/// `tauri.conf.json` and the behaviour carries `tao`'s own `CanJoinAllSpaces`, and overwriting
/// either would silently drop it.
fn assert_floating(panel: &PanelHandle<Wry>) {
    let window = panel.as_panel();

    panel.set_style_mask(
        StyleMask::from_raw(window.styleMask())
            .nonactivating_panel()
            .into(),
    );
    panel.set_collection_behavior(
        CollectionBehavior::from_raw(window.collectionBehavior())
            .can_join_all_spaces()
            .full_screen_auxiliary()
            .into(),
    );
    // Last, and after any `setAlwaysOnTop` on the TypeScript side: that call rewrites the level
    // back down to NSFloatingWindowLevel (3).
    panel.set_level(PanelLevel::Status.value());
}

/// Converts the panel window into a non-activating `NSPanel`, once, at startup.
pub fn convert(app: &AppHandle) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window(PANEL_LABEL) else {
        return Err(tauri::Error::Io(std::io::Error::other(format!(
            "no window labelled {PANEL_LABEL} to convert"
        ))));
    };

    let panel = window.to_panel::<FloatingPanel>()?;

    // An `NSPanel` closes itself on Escape and by default deallocates when it does; the app only
    // ever hides this window, so make a stray close survivable.
    panel.set_released_when_closed(false);
    // A floating `NSPanel` otherwise vanishes whenever the owning app deactivates — which, for
    // an accessory-policy app that is never active, would mean "always".
    panel.set_hides_on_deactivate(false);

    assert_floating(&panel);

    Ok(())
}

/// Re-asserts the level and collection behaviour after the frontend reveals the panel.
///
/// Fails loudly rather than silently: ADR-0010 lost a run to an `invoke` that never reached Rust
/// and said nothing.
#[tauri::command]
pub fn float_panel_above_full_screen(app: AppHandle) -> Result<(), String> {
    let panel = app
        .get_webview_panel(PANEL_LABEL)
        .map_err(|error| format!("window {PANEL_LABEL} is not an NSPanel: {error:?}"))?;

    assert_floating(&panel);

    Ok(())
}
