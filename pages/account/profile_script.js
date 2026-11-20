const users = {
    "ElectricEvan": {
        username: "ElectricEvan",
        memberSince: "January 1, 2023",
        songsShared: 15,
        likesReceived: 42,
        flamesReceived: 7,
        recentActivity: [
            { title: "Bohemian Rhapsody", artist: "Queen" },
            { title: "Stairway to Heaven", artist: "Led Zeppelin" },
            { title: "Imagine", artist: "John Lennon" }
        ],
        favoriteGenres: ["Rock", "Classical", "Jazz", "Pop", "Electronic"]
    },
    "usertwo": {
        username: "usertwo",
        memberSince: "May 15, 2022",
        songsShared: 42,
        likesReceived: 128,
        flamesReceived: 16,
        recentActivity: [
            { title: "Electric Feel", artist: "MGMT" },
            { title: "Blue in Green", artist: "Miles Davis" },
            { title: "Crystallize", artist: "Lindsey Stirling" }
        ],
        favoriteGenres: ["Indie Rock", "Electronic", "Jazz"]
    }
};

function getUserData() {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('user');

    if (!username) return users["ElectricEvan"];
    return users[username] || {
        username,
        memberSince: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        songsShared: 0,
        likesReceived: 0,
        flamesReceived: 0,
        recentActivity: [],
        favoriteGenres: []
    };
}

let userData = getUserData();

function updateProfile() {
    document.getElementById('username').textContent = userData.username;
    document.getElementById('username-edit').value = userData.username;
    document.getElementById('member-since').textContent = userData.memberSince;
    document.getElementById('songs-shared').textContent = userData.songsShared;
    document.getElementById('likes-received').textContent = userData.likesReceived;
    document.getElementById('flames-received').textContent = userData.flamesReceived;

    const activityList = document.getElementById('activity-list');
    activityList.replaceChildren();
    if (!userData.recentActivity.length) {
        activityList.textContent = 'No recent activity yet.';
    }
    userData.recentActivity.forEach(song => {
        const item = document.createElement('div');
        item.className = 'song-item';
        item.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="var(--accent)">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>`;
        const info = document.createElement('div');
        info.className = 'song-info';
        const title = document.createElement('strong');
        title.textContent = song.title;
        info.append(title, ` by ${song.artist}`);
        item.appendChild(info);
        activityList.appendChild(item);
    });

    updateGenreList();
}

function updateGenreList() {
    const genreList = document.getElementById('genre-list');
    genreList.replaceChildren();
    userData.favoriteGenres.forEach(genre => {
        const tag = document.createElement('span');
        tag.className = 'genre-item';
        tag.textContent = genre;

        const remove = document.createElement('button');
        remove.className = 'remove-genre';
        remove.textContent = '×';
        remove.addEventListener('click', () => removeGenre(genre));

        tag.appendChild(remove);
        genreList.appendChild(tag);
    });
}

function addGenre() {
    const newGenre = document.getElementById('new-genre').value.trim();
    if (newGenre && !userData.favoriteGenres.includes(newGenre)) {
        userData.favoriteGenres.push(newGenre);
        updateGenreList();
        document.getElementById('new-genre').value = '';
    }
}

function removeGenre(genre) {
    userData.favoriteGenres = userData.favoriteGenres.filter(g => g !== genre);
    updateGenreList();
}

function toggleEditMode() {
    const editMode = document.body.classList.toggle('edit-mode');
    document.getElementById('username').classList.toggle('hidden', editMode);
    document.getElementById('username-edit').classList.toggle('hidden', !editMode);
    document.getElementById('genre-edit').classList.toggle('hidden', !editMode);
    document.getElementById('edit-controls').classList.toggle('hidden', !editMode);

    if (editMode) {
        document.getElementById('username-edit').value = userData.username;
    }
}

function saveChanges() {
    userData.username = document.getElementById('username-edit').value;
    updateProfile();
    toggleEditMode();
}

function cancelEdit() {
    toggleEditMode();
    updateProfile();
}

const profileColorOptions = [
    '#A94CD6',
    '#17a846',
    '#d32f2f',
    '#1E90FF',
    '#FFA500',
    '#008080'
];

function initializeProfileColorSelector() {
    const profilePicture = document.querySelector('.profile-picture');
    const colorSelectorContainer = document.createElement('div');
    colorSelectorContainer.className = 'profile-picture-colors hidden';

    profileColorOptions.forEach(color => {
        const colorOption = document.createElement('div');
        colorOption.className = 'profile-color-option';
        colorOption.style.backgroundColor = color;

        colorOption.addEventListener('click', () => {
            document.querySelectorAll('.profile-color-option').forEach(opt =>
                opt.classList.remove('selected')
            );

            colorOption.classList.add('selected');

            profilePicture.style.backgroundColor = color;
        });

        colorSelectorContainer.appendChild(colorOption);
    });

    profilePicture.parentNode.insertBefore(colorSelectorContainer, profilePicture.nextSibling);

    const originalToggleEditMode = toggleEditMode;
    toggleEditMode = function() {
        originalToggleEditMode();

        const isEditMode = document.body.classList.contains('edit-mode');
        colorSelectorContainer.classList.toggle('hidden', !isEditMode);
    };
}

document.addEventListener('DOMContentLoaded', function() {
    updateProfile();
    initializeProfileColorSelector();

    document.getElementById('edit-toggle').addEventListener('click', toggleEditMode);
    document.getElementById('save-changes').addEventListener('click', saveChanges);
    document.getElementById('cancel-edit').addEventListener('click', cancelEdit);

    document.getElementById('add-genre-btn').addEventListener('click', addGenre);
    document.getElementById('new-genre').addEventListener('keydown', e => {
        if (e.key === 'Enter') addGenre();
    });

    document.getElementById('sign-out-btn').addEventListener('click', function() {
        try { localStorage.removeItem('ostinato.spotifyToken'); } catch {}
        window.location.href = '../landing/landing.html';
    });
});
