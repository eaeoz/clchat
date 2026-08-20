import blessed from 'blessed';
import api from '../api/client.js';
import socket from '../socket/client.js';
import { getCurrentTheme } from '../themes/index.js';
import { saveSession } from '../utils/storage.js';
import { getTerminalSize } from '../utils/terminal.js';

// ─────────────────────────────────────────────────────────────
//  ASCII logo lines (shown when terminal is wide enough)
// ─────────────────────────────────────────────────────────────
const LOGO = [
  '  ███████╗ ██████╗  ██████╗██╗ █████╗ ██╗      ',
  '  ██╔════╝██╔═══██╗██╔════╝██║██╔══██╗██║      ',
  '  ███████╗██║   ██║██║     ██║███████║██║      ',
  '  ╚════██║██║   ██║██║     ██║██╔══██║██║      ',
  '  ███████║╚██████╔╝╚██████╗██║██║  ██║███████╗ ',
  '  ╚══════╝ ╚═════╝  ╚═════╝╚═╝╚═╝  ╚═╝╚══════╝ ',
];
const TAGLINE = '  Connect · Chat · Communicate  ';

export default function createLoginScreen(screen, onLogin) {
  const theme = getCurrentTheme();
  const { width: termW, height: termH } = getTerminalSize();
  const showLogo = termH >= 30 && termW >= 70;

  // ── Root container ──────────────────────────────────────────
  const container = blessed.box({
    parent: screen,
    width: '100%',
    height: '100%',
    style: { bg: theme.bg },
  });

  // ── Background decorative top gradient bar ──────────────────
  blessed.box({
    parent: container,
    top: 0,
    width: '100%',
    height: showLogo ? LOGO.length + 3 : 4,
    style: { bg: theme.headerBg },
  });

  // ── Logo or title ───────────────────────────────────────────
  if (showLogo) {
    LOGO.forEach((line, i) => {
      blessed.text({
        parent: container,
        top: 1 + i,
        width: '100%',
        height: 1,
        content: `{center}${line}{/center}`,
        tags: true,
        style: { fg: theme.primary, bg: theme.headerBg },
      });
    });
    blessed.text({
      parent: container,
      top: 1 + LOGO.length,
      width: '100%',
      height: 1,
      content: `{center}${TAGLINE}{/center}`,
      tags: true,
      style: { fg: theme.muted, bg: theme.headerBg },
    });
  } else {
    blessed.text({
      parent: container,
      top: 1,
      width: '100%',
      height: 1,
      content: `{center}{bold}✦ SOCIAL CLI ✦{/bold}{/center}`,
      tags: true,
      style: { fg: theme.accent, bg: theme.headerBg },
    });
    blessed.text({
      parent: container,
      top: 2,
      width: '100%',
      height: 1,
      content: `{center}Connect · Chat · Communicate{/center}`,
      tags: true,
      style: { fg: theme.muted, bg: theme.headerBg },
    });
  }

  const logoBottom = showLogo ? LOGO.length + 3 : 4;

  // ── Main form card ──────────────────────────────────────────
  const cardW = Math.min(68, Math.max(50, Math.floor(termW * 0.72)));
  const formBox = blessed.box({
    parent: container,
    top: logoBottom,
    width: cardW,
    height: `100%-${logoBottom + 3}`,
    left: 'center',
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.bg,
      border: { fg: theme.border },
    },
  });

  // ── Tab bar ─────────────────────────────────────────────────
  const tabBar = blessed.box({
    parent: formBox,
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    style: { bg: theme.sidebarBg || theme.inputBg },
  });

  const tabLogin = blessed.text({
    parent: tabBar,
    top: 1,
    left: 2,
    width: 18,
    height: 1,
    content: '',
    tags: true,
    style: { fg: theme.primary, bg: theme.sidebarBg || theme.inputBg },
    clickable: true,
  });

  const tabRegister = blessed.text({
    parent: tabBar,
    top: 1,
    left: 22,
    width: 20,
    height: 1,
    content: '',
    tags: true,
    style: { fg: theme.muted, bg: theme.sidebarBg || theme.inputBg },
    clickable: true,
  });

  // Divider
  blessed.line({
    parent: formBox,
    top: 3,
    left: 0,
    orientation: 'horizontal',
    style: { fg: theme.border },
  });

  // ── Fields area ─────────────────────────────────────────────
  const fieldsContainer = blessed.box({
    parent: formBox,
    top: 5,
    left: 3,
    right: 3,
    bottom: 7,
  });

  // ─── Login: Username ────────────────────────────────────────
  blessed.text({
    parent: fieldsContainer,
    top: 0,
    left: 0,
    height: 1,
    content: '{bold}Username{/bold}',
    tags: true,
    style: { fg: theme.muted },
  });

  const usernameInput = blessed.textbox({
    parent: fieldsContainer,
    top: 1,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.inputBg,
      border: { fg: theme.border },
      focus: { border: { fg: theme.primary } },
    },
    secret: false,
  });

  // ─── Login: Password ────────────────────────────────────────
  blessed.text({
    parent: fieldsContainer,
    top: 5,
    left: 0,
    height: 1,
    content: '{bold}Password{/bold}',
    tags: true,
    style: { fg: theme.muted },
  });

  const passwordInput = blessed.textbox({
    parent: fieldsContainer,
    top: 6,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.inputBg,
      border: { fg: theme.border },
      focus: { border: { fg: theme.primary } },
    },
    secret: true,
  });

  // ─── Register extra fields ──────────────────────────────────
  // Row A: Email
  const r_emailLabel = blessed.text({
    parent: fieldsContainer,
    top: 10,
    left: 0,
    height: 1,
    content: '{bold}Email{/bold}',
    tags: true,
    style: { fg: theme.muted },
    hidden: true,
  });

  const r_emailInput = blessed.textbox({
    parent: fieldsContainer,
    top: 11,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.inputBg,
      border: { fg: theme.border },
      focus: { border: { fg: theme.primary } },
    },
    hidden: true,
  });

  // Row B: Full Name + Age (side by side)
  const r_fullNameLabel = blessed.text({
    parent: fieldsContainer,
    top: 15,
    left: 0,
    width: '60%-1',
    height: 1,
    content: '{bold}Full Name{/bold} {gray-fg}(optional){/gray-fg}',
    tags: true,
    style: { fg: theme.muted },
    hidden: true,
  });

  const r_fullNameInput = blessed.textbox({
    parent: fieldsContainer,
    top: 16,
    left: 0,
    width: '60%-1',
    height: 3,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.inputBg,
      border: { fg: theme.border },
      focus: { border: { fg: theme.primary } },
    },
    hidden: true,
  });

  const r_ageLabel = blessed.text({
    parent: fieldsContainer,
    top: 15,
    left: '60%+1',
    width: '40%-2',
    height: 1,
    content: '{bold}Age{/bold} {gray-fg}(18-100){/gray-fg}',
    tags: true,
    style: { fg: theme.muted },
    hidden: true,
  });

  const r_ageInput = blessed.textbox({
    parent: fieldsContainer,
    top: 16,
    left: '60%+1',
    width: '40%-2',
    height: 3,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.inputBg,
      border: { fg: theme.border },
      focus: { border: { fg: theme.primary } },
    },
    hidden: true,
  });

  // Row C: Gender
  const r_genderLabel = blessed.text({
    parent: fieldsContainer,
    top: 20,
    left: 0,
    height: 1,
    content: '{bold}Gender{/bold} {gray-fg}(male / female){/gray-fg}',
    tags: true,
    style: { fg: theme.muted },
    hidden: true,
  });

  const r_genderInput = blessed.textbox({
    parent: fieldsContainer,
    top: 21,
    left: 0,
    width: '100%',
    height: 3,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.inputBg,
      border: { fg: theme.border },
      focus: { border: { fg: theme.primary } },
    },
    hidden: true,
  });

  // ── Message box ──────────────────────────────────────────────
  const messageBox = blessed.text({
    parent: formBox,
    bottom: 4,
    left: 3,
    right: 3,
    height: 3,
    content: '',
    tags: true,
    style: { fg: theme.warning },
    wrap: true,
  });

  // ── Submit button ─────────────────────────────────────────────
  const submitBtn = blessed.button({
    parent: formBox,
    bottom: 1,
    left: 'center',
    width: 28,
    height: 3,
    content: '',
    tags: true,
    border: { type: 'line' },
    style: {
      fg: theme.buttonFg,
      bg: theme.buttonBg,
      border: { fg: theme.buttonBg },
      hover: { bg: theme.accent },
      focus: { border: { fg: theme.fg } },
    },
    mouse: true,
  });

  // ── Bottom bar ───────────────────────────────────────────────
  blessed.text({
    parent: container,
    bottom: 1,
    width: '100%',
    height: 1,
    content: '{center}🌐  https://netcify.netlify.app{/center}',
    tags: true,
    style: { fg: theme.accent, bg: theme.statusBarBg },
  });

  blessed.text({
    parent: container,
    bottom: 0,
    width: '100%',
    height: 1,
    content: '{center}F2 Login  ·  F3 Register  ·  Tab Next field  ·  Enter Submit  ·  Esc Quit{/center}',
    tags: true,
    style: { fg: theme.dimFg || theme.muted, bg: theme.statusBarBg },
  });

  // ── State ────────────────────────────────────────────────────
  let isLoginMode = true;
  const regElements = [
    r_emailLabel, r_emailInput,
    r_fullNameLabel, r_fullNameInput,
    r_ageLabel, r_ageInput,
    r_genderLabel, r_genderInput,
  ];
  const allInputs = [usernameInput, passwordInput, r_emailInput, r_fullNameInput, r_ageInput, r_genderInput];

  function updateTabUI() {
    if (isLoginMode) {
      tabLogin.setContent(` {bold}{underline}● LOGIN{/underline}{/bold} `);
      tabLogin.style.fg = theme.activeTab || theme.primary;
      tabRegister.setContent(` ○ REGISTER `);
      tabRegister.style.fg = theme.inactiveTab || theme.muted;
      submitBtn.setContent('{center}{bold}  LOGIN  {/bold}{/center}');
    } else {
      tabLogin.setContent(` ○ LOGIN `);
      tabLogin.style.fg = theme.inactiveTab || theme.muted;
      tabRegister.setContent(` {bold}{underline}● REGISTER{/underline}{/bold} `);
      tabRegister.style.fg = theme.activeTab || theme.primary;
      submitBtn.setContent('{center}{bold}  REGISTER  {/bold}{/center}');
    }
  }

  function clearAllFields() {
    allInputs.forEach(input => {
      input.setValue('');
      input._value = '';
    });
  }

  function setMode(loginMode) {
    isLoginMode = loginMode;
    clearAllFields();
    regElements.forEach(f => { f.hidden = loginMode; });
    updateTabUI();
    messageBox.setContent('');
    screen.render();
  }

  tabLogin.on('click', () => { if (!isLoginMode) switchToLogin(); });
  tabRegister.on('click', () => { if (isLoginMode) switchToRegister(); });

  function showMessage(msg, isError = false) {
    messageBox.setContent(msg);
    messageBox.style.fg = isError ? theme.error : theme.warning;
    screen.render();
  }

  let isSubmitting = false;

  function setLoading(loading) {
    isSubmitting = loading;
    if (loading) {
      submitBtn.setContent('{center}⟳  Loading...{/center}');
      submitBtn.style.fg = theme.muted;
    } else {
      submitBtn.style.fg = theme.buttonFg;
      updateTabUI();
    }
    screen.render();
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    const username = usernameInput.getValue().trim();
    const password = passwordInput.getValue().trim();
    if (!username || !password) {
      showMessage('⚠  Username and password are required', true);
      return;
    }

    setLoading(true);
    try {
      if (isLoginMode) {
        showMessage('Signing in…');
        const result = await api.login({ username, password });
        saveSession(result.accessToken, result.refreshToken, result.user);
        showMessage('{green-fg}✓  Login successful!{/green-fg}');
        setTimeout(() => onLogin(result.user, result.accessToken, result.refreshToken), 500);
      } else {
        const email = r_emailInput.getValue().trim();
        const fullName = r_fullNameInput.getValue().trim();
        const age = parseInt(r_ageInput.getValue().trim());
        const gender = r_genderInput.getValue().trim();

        if (!email) { showMessage('⚠  Email is required', true); setLoading(false); return; }
        if (!age || age < 18 || age > 100) { showMessage('⚠  Age must be between 18–100', true); setLoading(false); return; }
        if (!['male', 'female'].includes(gender.toLowerCase())) {
          showMessage('⚠  Gender must be "male" or "female"', true);
          setLoading(false);
          return;
        }

        showMessage('Creating account…');
        const result = await api.register({
          username, email, password,
          fullName: fullName || undefined,
          age,
          gender: gender.toLowerCase().startsWith('m') ? 'Male' : 'Female',
        });

        if (result.requiresEmailVerification) {
          setMode(true);
          showMessage(
            '{yellow-fg}✓  Account created!{/yellow-fg}\n' +
            '{white-fg}A verification link was sent to your email.{/white-fg}\n' +
            '{gray-fg}Click it to activate your account, then log in.{/gray-fg}'
          );
        } else {
          saveSession(result.accessToken, result.refreshToken, result.user);
          showMessage('{green-fg}✓  Registration successful!{/green-fg}');
          setTimeout(() => onLogin(result.user, result.accessToken, result.refreshToken), 500);
        }
      }
    } catch (error) {
      const data = error.data || {};
      if (data.requiresEmailVerification) {
        showMessage(
          `{yellow-fg}⚠  Email not verified!{/yellow-fg}\n` +
          `{white-fg}Check your inbox for ${data.email || 'your email'}.{/white-fg}`,
          false
        );
      } else {
        showMessage(`{red-fg}✗  ${data.error || error.message || 'Authentication failed'}{/red-fg}`, true);
      }
    } finally {
      setLoading(false);
    }
  }

  submitBtn.on('press', () => { if (!isSubmitting) handleSubmit(); });

  // ── Focus management ─────────────────────────────────────────
  const loginFields = [usernameInput, passwordInput];
  const registerFields = [usernameInput, passwordInput, r_emailInput, r_fullNameInput, r_ageInput, r_genderInput];
  let fieldIndex = 0;
  let exiting = false;

  function getCurrentFields() { return isLoginMode ? loginFields : registerFields; }

  function focusField(index) {
    const fields = getCurrentFields();
    fieldIndex = ((index % fields.length) + fields.length) % fields.length;
    const target = fields[fieldIndex];

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
    setMode(true);
    fieldIndex = 0;
    focusField(0);
  }

  function switchToRegister() {
    setMode(false);
    fieldIndex = 0;
    focusField(0);
  }

  function quit() {
    if (exiting) return;
    exiting = true;
    socket.disconnect();
    process.exit(0);
  }

  // Enter-key progression
  usernameInput.key(['enter'], () => focusField(1));
  passwordInput.key(['enter'], () => handleSubmit());
  r_emailInput.key(['enter'], () => focusField(3));
  r_fullNameInput.key(['enter'], () => focusField(4));
  r_ageInput.key(['enter'], () => focusField(5));
  r_genderInput.key(['enter'], () => handleSubmit());

  // Program-level hotkeys
  const programKeypressHandler = (ch, key) => {
    if (key.name === 'escape') { quit(); return; }
    if (key.name === 'tab') { focusField(fieldIndex + 1); return; }
    if (key.name === 'f2') { switchToLogin(); return; }
    if (key.name === 'f3') { switchToRegister(); return; }
  };
  screen.program.on('keypress', programKeypressHandler);

  // ── Initial render ───────────────────────────────────────────
  setMode(true);   // sets tab labels + button text
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
