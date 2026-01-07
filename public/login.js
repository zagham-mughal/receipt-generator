"use strict";
// Login page TypeScript
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
                    // Redirect to main page
                    window.location.href = '/';
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