document.addEventListener('DOMContentLoaded', async () => {
    const authInstance = new Auth();
    
    const response = await fetch(`${authInstance.API_BASE_URL}/api/auth/session`, { credentials: 'include' });
    if (!response.ok) {
        window.location.href = '../login.html';
        return;
    } 
    const session = await response.json();

    if (!session.user) {
        alert('No se pudo cargar el perfil');
        window.location.href = '../login.html';
        return;
    }
    const user = session.user;

    document.getElementById('profile-pic').src = user.imageUrl || '../imagenes/default-profile.png';
    document.getElementById('user-name').textContent = `${user.name} ${user.surnames}`;

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await authInstance.logout();
    });

    document.getElementById('edit-profile-btn').addEventListener('click', () => {
        window.location.href = '../edit_profile.html';
    });
});

