let currentUser = JSON.parse(localStorage.getItem('user')) || null;
const appDiv = document.getElementById('app');
const navbar = document.getElementById('navbar');

// --- Initialization ---
function init() {
    if (currentUser) {
        navbar.classList.remove('hidden');
        navigate('feed');
    } else {
        navbar.classList.add('hidden');
        renderLogin();
    }
}

// --- Navigation ---
function navigate(view, username = null) {
    if (view === 'feed') renderFeed();
    else if (view === 'profile') renderProfile(username || currentUser.username);
}

function logout() {
    currentUser = null;
    localStorage.removeItem('user');
    init();
}

// --- API Helpers ---
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`/api/${endpoint}`, options);
    return res.json();
}

// --- Auth Views ---
function renderLogin() {
    appDiv.innerHTML = `
        <div class="auth-container">
            <h1>Login</h1>
            <input type="text" id="login-user" placeholder="Username" required>
            <input type="password" id="login-pass" placeholder="Password" required>
            <button class="btn" onclick="handleAuth('login')">Log In</button>
            <div class="switch-auth" onclick="renderSignup()">Don't have an account? Sign up.</div>
        </div>
    `;
}

function renderSignup() {
    appDiv.innerHTML = `
        <div class="auth-container">
            <h1>Sign Up</h1>
            <input type="text" id="signup-name" placeholder="Display Name" required>
            <input type="text" id="signup-user" placeholder="Username" required>
            <input type="password" id="signup-pass" placeholder="Password" required>
            <button class="btn" onclick="handleAuth('signup')">Sign Up</button>
            <div class="switch-auth" onclick="renderLogin()">Already have an account? Log in.</div>
        </div>
    `;
}

async function handleAuth(action) {
    const userEl = document.getElementById(`${action}-user`);
    const passEl = document.getElementById(`${action}-pass`);
    const nameEl = document.getElementById(`${action}-name`);
    
    const payload = { action, username: userEl.value, password: passEl.value };
    if (action === 'signup') payload.displayName = nameEl.value;

    if(!payload.username || !payload.password) return alert("Please fill all fields");

    const res = await apiCall('auth', 'POST', payload);
    if (res.success) {
        currentUser = res.user;
        localStorage.setItem('user', JSON.stringify(currentUser));
        init();
    } else {
        alert(res.error);
    }
}

// --- Feed View ---
async function renderFeed() {
    appDiv.innerHTML = `
        <div class="create-post">
            <textarea id="post-content" placeholder="What's on your mind, ${currentUser.displayName}?"></textarea>
            <button class="btn" onclick="createPost()">Post</button>
        </div>
        <div class="search-bar">
            <input type="text" id="search-input" placeholder="Search posts..." oninput="filterPosts()">
        </div>
        <div id="posts-container">Loading posts...</div>
    `;
    loadPosts();
}

async function loadPosts() {
    const posts = await apiCall('posts');
    window.allPosts = posts; // store for search
    displayPosts(posts);
}

function displayPosts(posts) {
    const container = document.getElementById('posts-container');
    if (posts.length === 0) {
        container.innerHTML = "<p>No posts yet. Be the first to say something!</p>";
        return;
    }

    container.innerHTML = posts.map(post => `
        <div class="post-card">
            <div class="post-header">
                <div>
                    <span class="post-author cursor-pointer" onclick="navigate('profile', '${post.author}')">${post.displayName}</span>
                    <span class="post-username">@${post.author}</span>
                </div>
                <span class="post-time">${post.timestamp}</span>
            </div>
            <div class="post-content">${post.content}</div>
            <div class="post-actions">
                <button class="action-btn" onclick="reactPost('${post.id}', 'like')">
                    👍 <span id="likes-${post.id}">${post.likes.length}</span>
                </button>
                <button class="action-btn" onclick="reactPost('${post.id}', 'dislike')">
                    👎 <span id="dislikes-${post.id}">${post.dislikes.length}</span>
                </button>
                ${post.author === currentUser.username ? 
                    `<button class="action-btn delete" onclick="deletePost('${post.id}')">🗑️ Delete</button>` : ''}
            </div>
        </div>
    `).join('');
}

function filterPosts() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = window.allPosts.filter(p => 
        p.content.toLowerCase().includes(query) || 
        p.author.toLowerCase().includes(query) ||
        p.displayName.toLowerCase().includes(query)
    );
    displayPosts(filtered);
}

async function createPost() {
    const content = document.getElementById('post-content').value;
    if (!content.trim()) return;

    const res = await apiCall('posts', 'POST', { username: currentUser.username, content });
    if (res.success) renderFeed();
}

async function deletePost(id) {
    if(!confirm("Delete this post?")) return;
    const res = await apiCall(`posts/${id}`, 'DELETE', { username: currentUser.username });
    if (res.success) renderFeed();
}

async function reactPost(id, action) {
    const res = await apiCall(`posts/${id}/react`, 'POST', { username: currentUser.username, action });
    if (res.success) {
        document.getElementById(`likes-${id}`).innerText = res.likes;
        document.getElementById(`dislikes-${id}`).innerText = res.dislikes;
    }
}

// --- Profile View ---
async function renderProfile(username) {
    appDiv.innerHTML = "Loading profile...";
    const profile = await apiCall(`profile/${username}`);
    if (profile.error) return appDiv.innerHTML = "User not found.";

    const isOwnProfile = username === currentUser.username;
    
    let html = `
        <div class="profile-header">
            <div class="avatar">${profile.displayName.charAt(0).toUpperCase()}</div>
            <h2>${profile.displayName}</h2>
            <p class="post-username">@${profile.username}</p>
            <p style="margin-top: 10px">${profile.bio}</p>
            
            <div class="profile-stats">
                <div class="stat">
                    <div class="stat-val">${profile.postCount}</div>
                    <div>Posts</div>
                </div>
                <div class="stat">
                    <div class="stat-val">${profile.likesReceived}</div>
                    <div>Likes</div>
                </div>
            </div>
            
            ${isOwnProfile ? `<button class="btn" style="margin-top: 20px; width: auto; padding: 8px 20px;" onclick="editProfile()">Edit Profile</button>` : ''}
        </div>
        <div id="posts-container"></div>
    `;
    
    appDiv.innerHTML = html;
    window.allPosts = profile.posts; // hack for reuse of displayPosts
    displayPosts(profile.posts);
}

async function editProfile() {
    const newName = prompt("Enter new display name:", currentUser.displayName);
    const newBio = prompt("Enter new bio:");
    
    if (newName !== null && newBio !== null) {
        const res = await apiCall(`profile/${currentUser.username}`, 'POST', { 
            requester: currentUser.username, 
            displayName: newName, 
            bio: newBio 
        });
        if (res.success) {
            currentUser.displayName = newName;
            localStorage.setItem('user', JSON.stringify(currentUser));
            renderProfile(currentUser.username);
        }
    }
}

// Start app
init();