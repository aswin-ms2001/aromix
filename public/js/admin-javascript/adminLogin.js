const toggleBtn = document.getElementById('togglePassword');
const passwordInput = document.getElementById('passwordInput');

toggleBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  toggleBtn.textContent = isPassword ? '🙈' : '👁️';
});
