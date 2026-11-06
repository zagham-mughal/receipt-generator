"use strict";
// Login page TypeScript
// Where to go after login: the ?next= path set by the server, but only if it points
// to this same site (never an outside URL), and never back to the login page itself
function getReturnPath() {
    const next = new URLSearchParams(window.location.search).get('next');
    if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
        return '/';
    }
    try {
        const url = new URL(next, window.location.origin);
        if (url.origin !== window.location.origin || url.pathname.startsWith('/login')) {
            return '/';
        }
        return url.pathname + url.search + url.hash;
    }
    catch {
        return '/';
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
    }
    function hideError() {
        errorMessage.classList.remove('show');
    }
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideError();
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            if (!username || !password) {
                showError('Please enter both username and password');
                return;
            }
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    // Go back to the page that sent us here, or the main page
                    window.location.href = getReturnPath();
                }
                else {
                    showError(data.error || 'Invalid username or password');
                }
            }
            catch (error) {
                console.error('Login error:', error);
                showError('An error occurred. Please try again.');
            }
        });
    }
});
//# sourceMappingURL=login.js.map