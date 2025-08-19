(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const darkMode = localStorage.getItem("dark-mode") || (prefersDark ? "enabled" : "disabled");

    document.documentElement.classList.add("no-transitions");

    if (darkMode === "enabled") {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
})();

function setDarkMode(enabled) {
    if (enabled) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("dark-mode", "enabled");
    } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("dark-mode", "disabled");
    }
}

window.onload = function () {
    document.documentElement.classList.remove("no-transitions");
};
