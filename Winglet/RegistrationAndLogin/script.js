// --- 1. UI ELEMENTS ---
const container = document.getElementById("container");
const registerBtn = document.getElementById("register");
const loginBtn = document.getElementById("login");

// Toggle between Sign In and Sign Up panels
registerBtn.addEventListener("click", () => {
  container.classList.add("active");
});

loginBtn.addEventListener("click", () => {
  container.classList.remove("active");
});

// --- 2. CONFIGURATION ---
const API_BASE_URL = "https://businessreportsmanager-oiwy.onrender.com/api";

// --- 3. LOGIN LOGIC (Sign In) ---
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault(); // Stop the page from refreshing!
    
    const userName = loginForm.querySelector('input[type="text"]')?.value;
    const password = loginForm.querySelector('input[type="password"]')?.value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userName, password })
        });

        const result = await response.json();

        if (response.ok) {
            const tokenValue = result.token || result.data?.token || result.accessToken;
            localStorage.setItem('authToken', tokenValue);
            console.log("Login success, redirecting...");
            // This is the most reliable way to redirect after an alert
            alert('Login Successful!');
            window.location.href = '../main.html';
        } else {
            alert('Login Failed: ' + (result.message || 'Check credentials'));
        }
    } catch (err) {
        console.error('Login Error:', err);
        alert('Server Error. Is the API running?');
    }
});

const registrationForm = document.querySelector('.sign-up form');

    registrationForm.addEventListener('submit', async (e) => {
        // 1. Prevent the page from refreshing
        e.preventDefault();

        // 2. Capture the form data
        const roleElement = document.getElementById('Roles');
        const username = registrationForm.querySelector('input[placeholder="User"]').value;
        const email = registrationForm.querySelector('input[placeholder="Email"]').value;
        const password = registrationForm.querySelector('input[placeholder="Password"]').value;
        // Get the text of the selected option (e.g., "Employee")
        const role = roleElement.options[roleElement.selectedIndex].text;

        const userData = {
            username: username,
            email: email,
            password: password,
            role: role
        };

        try {
            // 3. Make the API call
            const response = await fetch('https://businessreportsmanager-oiwy.onrender.com/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            // 4. Handle the response
            if (response.ok) {
                alert('Registration successful!');
                console.log('Success:', result);
            } else {
                alert('Registration failed: ' + (result.message || 'Unknown error'));
                console.warn('Error detail:', result);
            }
        } catch (error) {
            console.error('Network error:', error);
            alert('Could not connect to the server.');
        }
    });

// --- 5. AUTHENTICATED FETCH HELPER ---
async function authFetch(endpoint, options = {}) {
  const savedAuthToken = localStorage.getItem("authToken");
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
    Authorization: `Bearer ${savedAuthToken}`,
  };
  return fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
}
