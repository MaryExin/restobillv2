export function setupAlertOverride() {
  const nativeAlert = window.alert;

  window.alert = function (message) {
    try {
      window.dispatchEvent(
        new CustomEvent("app-alert", {
          detail: { message: String(message ?? "") },
        })
      );
    } catch (error) {
      nativeAlert(String(message ?? ""));
    }
  };
}