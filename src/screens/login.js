import blessed from 'blessed';
import api from '../api/client.js';
import socket from '../socket/client.js';
import { getCurrentTheme } from '../themes/index.js';
import { saveSession } from '../utils/storage.js';

export default function createLoginScreen(screen, onLogin) {
  const theme = getCurrentTheme();

  const container = blessed.box({
    parent: screen,
    width: '100%',
    height: '100%',
    style: { bg: theme.bg },
  });

  blessed.text({
    parent: container, top: 1, width: '100%', height: 1,
    content: '{center}{bold}SOCIAL CLI{/bold}{/center}',
    tags: true, style: { fg: theme.accent, bg: theme.bg },
  });

  blessed.text({
    parent: container, top: 2, width: '100%', height: 1,
    content: '{center}Connect \u00b7 Chat \u00b7 Communicate{/center}',
    tags: true, style: { fg: theme.muted, bg: theme.bg },
  });

  const formBox = blessed.box({
    parent: container, top: 4, width: '70%', height: 'calc(100% - 8)',
    left: 'center',
    border: { type: 'line' },
    style: { fg: theme.fg, bg: theme.bg, border: { fg: theme.border } },
  });

  const tabLogin = blessed.text({
    parent: formBox, top: 1, left: 2, width: 14, height: 1,
    content: ' [ \u25C0 LOGIN ] ',
    tags: true, style: { fg: theme.primary, bg: theme.bg }, clickable: true,
  });

  const tabRegister = blessed.text({
    parent: formBox, top: 1, right: 2, width: 16, height: 1,
    content: ' [ REGISTER ] ',
    tags: true, style: { fg: theme.muted, bg: theme.bg }, clickable: true,
  });

  blessed.text({
    parent: formBox, top: 3, left: 1, width: '100%-2', height: 1,
    content: '\u2500'.repeat(66), style: { fg: theme.border },
  });

  const fieldsContainer = blessed.box({
    parent: formBox, top: 5, left: 'center', width: '90%', height: 'calc(100% - 12)',
  });

  // ── Row 1: Username | Password ──
  blessed.text({
    parent: fieldsContainer, top: 0, left: 0, width: '48%', height: 1,
    content: 'Username:', style: { fg: theme.fg },
  });

  const usernameInput = blessed.textbox({
    parent: fieldsContainer, top: 1, left: 0, width: '48%', height: 3,
    border: { type: 'line' },
    style: { fg: theme.fg, bg: theme.inputBg, border: { fg: theme.border }, focus: { border: { fg: theme.primary } } },
    secret: false,
  });

  blessed.text({
    parent: fieldsContainer, top: 0, left: '50%', width: '48%', height: 1,
    content: 'Password:', style: { fg: theme.fg },
  });

  const passwordInput = blessed.textbox({
    parent: fieldsContainer, top: 1, left: '50%', width: '48%', height: 3,
    border: { type: 'line' },
    style: { fg: theme.fg, bg: theme.inputBg, border: { fg: theme.border }, focus: { border: { fg: theme.primary } } },
    secret: true,
  });

  // ── Register Row 1: Email | Full Name ──
  const r_emailLabel = blessed.text({
    parent: fieldsContainer, top: 5, left: 0, width: '48%', height: 1,
    content: 'Email:', style: { fg: theme.fg }, hidden: true,
  });

  const r_emailInput = blessed.textbox({
    parent: fieldsContainer, top: 6, left: 0, width: '48%', height: 3,
    border: { type: 'line' },
    style: { fg: theme.fg, bg: theme.inputBg, border: { fg: theme.border }, focus: { border: { fg: theme.primary } } },
    hidden: true,
  });

  const r_fullNameLabel = blessed.text({
    parent: fieldsContainer, top: 5, left: '50%', width: '48%', height: 1,
    content: 'Full Name (optional):', style: { fg: theme.fg }, hidden: true,
  });

  const r_fullNameInput = blessed.textbox({
    parent: fieldsContainer, top: 6, left: '50%', width: '48%', height: 3,
    border: { type: 'line' },
    style: { fg: theme.fg, bg: theme.inputBg, border: { fg: theme.border }, focus: { border: { fg: theme.primary } } },
    hidden: true,
  });

  // ── Register Row 2: Age | Gender ──
  const r_ageLabel = blessed.text({
    parent: fieldsContainer, top: 10, left: 0, width: '48%', height: 1,
    content: 'Age (18-100):', style: { fg: theme.fg }, hidden: true,
  });

  const r_ageInput = blessed.textbox({
    parent: fieldsContainer, top: 11, left: 0, width: '48%', height: 3,
    border: { type: 'line' },
    style: { fg: theme.fg, bg: theme.inputBg, border: { fg: theme.border }, focus: { border: { fg: theme.primary } } },
    hidden: true,
  });

  const r_genderLabel = blessed.text({
    parent: fieldsContainer, top: 10, left: '50%', width: '48%', height: 1,
    content: 'Gender (male/female):', style: { fg: theme.fg }, hidden: true,
  });

  const r_genderInput = blessed.textbox({
    parent: fieldsContainer, top: 11, left: '50%', width: '48%', height: 3,
    border: { type: 'line' },
    style: { fg: theme.fg, bg: theme.inputBg, border: { fg: theme.border }, focus: { border: { fg: theme.primary } } },
    hidden: true,
  });

  // ── Message + Submit ──
  const messageBox = blessed.text({
    parent: formBox, bottom: 5, left: 'center', width: '80%', height: 2,
    content: '', tags: true, style: { fg: theme.warning },
  });

  const submitBtn = blessed.button({
    parent: formBox, bottom: 1, left: 'center', width: 30, height: 3,
    content: '{center}{bold}LOGIN{/bold}{/center}',
    tags: true, border: { type: 'line' },
    style: { fg: theme.buttonFg, bg: theme.buttonBg, border: { fg: theme.buttonBg }, hover: { bg: theme.accent } },
    mouse: true,
  });

  // ── Mode ──
  let isLoginMode = true;
  const regElements = [r_emailLabel, r_emailInput, r_fullNameLabel, r_fullNameInput, r_ageLabel, r_ageInput, r_genderLabel, r_genderInput];

  function setMode(loginMode) {
    isLoginMode = loginMode;
    regElements.forEach(f => { f.hidden = loginMode; });
    if (loginMode) {
      tabLogin.setContent(' [ \u25C0 LOGIN ] ');
      tabLogin.style.fg = theme.primary;
      tabRegister.setContent(' [ REGISTER ] ');
      tabRegister.style.fg = theme.muted;
      submitBtn.setContent('{center}{bold}LOGIN{/bold}{/center}');
    } else {
      tabLogin.setContent(' [ LOGIN ] ');
      tabLogin.style.fg = theme.muted;
      tabRegister.setContent(' [ \u25C0 REGISTER ] ');
      tabRegister.style.fg = theme.primary;
      submitBtn.setContent('{center}{bold}REGISTER{/bold}{/center}');
    }
    messageBox.setContent('');
    screen.render();
  }

  tabLogin.on('click', () => { switchToLogin(); });
  tabRegister.on('click', () => { switchToRegister(); });

  function showMessage(msg, isError = false) {
    messageBox.setContent(msg);
    messageBox.style.fg = isError ? theme.error : theme.warning;
    screen.render();
  }

  let isSubmitting = false;

  function setLoading(loading) {
    isSubmitting = loading;
    if (loading) {
      submitBtn.setContent('{center}...{/center}');
      submitBtn.style.fg = theme.muted;
    } else {
      submitBtn.style.fg = theme.buttonFg;
      submitBtn.setContent(isLoginMode
        ? '{center}{bold}LOGIN{/bold}{/center}'
        : '{center}{bold}REGISTER{/bold}{/center}');
    }
    screen.render();
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    const username = usernameInput.getValue().trim();
    const password = passwordInput.getValue();
    if (!username || !password) { showMessage('Username and password required', true); return; }

    setLoading(true);
    try {
      if (isLoginMode) {
        showMessage('Logging in...');
        const result = await api.login({ username, password });
        saveSession(result.accessToken, result.refreshToken, result.user);
        showMessage('{green-fg}Login successful!{/green-fg}');
        setTimeout(() => onLogin(result.user, result.accessToken, result.refreshToken), 500);
      } else {
        const email = r_emailInput.getValue().trim();
        const fullName = r_fullNameInput.getValue().trim();
        const age = parseInt(r_ageInput.getValue().trim());
        const gender = r_genderInput.getValue().trim();

        if (!email) { showMessage('Email required', true); setLoading(false); return; }
        if (!age || age < 18 || age > 100) { showMessage('Age must be 18-100', true); setLoading(false); return; }
        if (!['male', 'female'].includes(gender.toLowerCase())) { showMessage('Gender must be male or female', true); setLoading(false); return; }

        showMessage('Registering...');
        const result = await api.register({
          username, email, password,
          fullName: fullName || undefined,
          age, gender: gender.toLowerCase().startsWith('m') ? 'Male' : 'Female',
        });

        if (result.requiresEmailVerification) {
          showMessage('{yellow-fg}Check your email for verification.{/yellow-fg}');
          setMode(true);
        } else {
          saveSession(result.accessToken, result.refreshToken, result.user);
          showMessage('{green-fg}Registration successful!{/green-fg}');
          setTimeout(() => onLogin(result.user, result.accessToken, result.refreshToken), 500);
        }
      }
    } catch (error) {
      showMessage(`{red-fg}${error.data?.message || error.message || 'Failed'}{/red-fg}`, true);
    } finally {
      setLoading(false);
    }
  }

  submitBtn.on('press', () => { if (!isSubmitting) handleSubmit(); });

  // ── Navigation (all on program level — no element-level tab/escape) ──
  const loginFields = [usernameInput, passwordInput];
  const registerFields = [usernameInput, passwordInput, r_emailInput, r_fullNameInput, r_ageInput, r_genderInput];
  let fieldIndex = 0;
  let exiting = false;

  function getCurrentFields() { return isLoginMode ? loginFields : registerFields; }

  function focusField(index) {
    const fields = getCurrentFields();
    fieldIndex = ((index % fields.length) + fields.length) % fields.length;
    const target = fields[fieldIndex];

    // Stop reading on ALL other textboxes first
    allInputs.forEach(input => {
      if (input !== target && input._reading && typeof input.stopInput === 'function') {
        input.stopInput();
      }
    });

    target.focus();
    if (typeof target.readInput === 'function' && !target._reading) {
      target.readInput();
    }
    screen.render();
  }

  function switchToLogin() {
    if (!isLoginMode) { setMode(true); fieldIndex = 0; focusField(0); }
  }

  function switchToRegister() {
    if (isLoginMode) { setMode(false); fieldIndex = 0; focusField(0); }
  }

  function quit() {
    if (exiting) return;
    exiting = true;
    socket.disconnect();
    process.exit(0);
  }

  const allInputs = [usernameInput, passwordInput, r_emailInput, r_fullNameInput, r_ageInput, r_genderInput];

  // Enter advances to next field (on textboxes only — all are textboxes now)
  usernameInput.key(['enter'], () => focusField(1));
  passwordInput.key(['enter'], () => handleSubmit());
  r_emailInput.key(['enter'], () => focusField(3));
  r_fullNameInput.key(['enter'], () => focusField(4));
  r_ageInput.key(['enter'], () => focusField(5));
  r_genderInput.key(['enter'], () => handleSubmit());

  // ALL navigation via program-level handler
  const programKeypressHandler = (ch, key) => {
    if (key.name === 'escape') { quit(); return; }
    if (key.name === 'tab') { focusField(fieldIndex + 1); return; }
    if (key.name === 'f2') { switchToLogin(); return; }
    if (key.name === 'f3') { switchToRegister(); return; }
  };
  screen.program.on('keypress', programKeypressHandler);

  blessed.text({
    parent: container, bottom: 0, width: '100%', height: 1,
    content: '{center}F2: Login \u00b7 F3: Register \u00b7 Tab: next field \u00b7 Enter: next/submit \u00b7 Esc: quit{/center}',
    tags: true, style: { fg: theme.muted, bg: theme.statusBarBg },
  });

  screen.render();
  focusField(0);

  return {
    destroy() {
      screen.program.removeListener('keypress', programKeypressHandler);
      container.destroy();
    },
    show() { container.show(); screen.render(); },
    hide() { container.hide(); screen.render(); },
  };
}
