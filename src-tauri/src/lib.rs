// The app UI is the Svelte web app in /src. Rust only hosts it in a native window.
// Add native features (file dialogs, video, ...) here as plugins when a feature thread needs them.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init()) // opens the Release page in the default browser
        .run(tauri::generate_context!())
        .expect("error while running Yomineko");
}
