import blessed from 'blessed';
import api from '../api/client.js';
import socket from '../socket/client.js';
import { getCurrentTheme } from '../themes/index.js';
import { saveSession } from '../utils/storage.js';
import { getTerminalSize } from '../utils/terminal.js';
import { APP_VERSION } from '../version.js';

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
  // Logo needs a tall terminal — on medium ones those rows are needed
  // by the form card itself (content-driven sizing below).
  const showLogo = termH >= 36 && termW >= 70;
  // Taglines sit on headerBg — dim colors go invisible there on some
  // themes / 16-color terminals, so use the main foreground.
  const taglineFg = theme.fg;

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

  // ── Version (top-right corner, on the header surface) ───────
  if (APP_VERSION) {
    blessed.text({
      parent: container,
      top: 0,
      right: 1,
      height: 1,
      content: `v${APP_VERSION}`,
      tags: true,
      style: { fg: theme.fg, bg: theme.headerBg },
    });
  }

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
      style: { fg: taglineFg, bg: theme.headerBg },
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
      style: { fg: taglineFg, bg: theme.headerBg },
    });
  }

  const logoBottom = showLogo ? LOGO.length + 3 : 4;

  // ── Main form card ──────────────────────────────────────────
  // Height is driven by CONTENT (fields per mode), not by terminal %,
  // otherwise the card ends up shorter than its content and fields
  // overflow / borders get painted over. Falls back to a scrollable
  // fields area on very short terminals.
  const FIELDS_H = { login: 4, register: 12 };  // rows the fields need
  const CARD_RESERVED = 3 + 7 + 2;               // tab/divider area + button/msg + border
  const cardW = Math.min(68, Math.max(50, Math.floor(termW * 0.72)));
  const formBox = blessed.box({
    parent: container,
    top: logoBottom,
    width: cardW,
    height: Math.min(FIELDS_H.login + CARD_RESERVED, termH - logoBottom - 2),
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
    height: 2,
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
    top: 2,
    left: 0,
    orientation: 'horizontal',
    style: { fg: theme.border },
  });

  // ── Fields area ─────────────────────────────────────────────
  // Compact two-column grid so ALL fields fit without scrolling
  // (a scrolled container hides focused fields mid-tab). The
  // scrollable container remains as a safety net for very short
  // terminals — overflow is clipped instead of corrupting borders.
  const fieldsContainer = blessed.box({
    parent: formBox,
    top: 3,
    left: 3,
    right: 3,
    bottom: 7,
    scrollable: true,
    mouse: true,
  });

  const COL_L = { left: 0, width: '50%-2' };
  const COL_R = { left: '50%+2', width: '50%-2' };

  function fieldLabel(text, top, col) {
    return blessed.text({
      parent: fieldsContainer,
      top,
      ...col,
      height: 1,
      content: `{bold}${text}{/bold}`,
      tags: true,
      style: { fg: theme.muted },
    });
  }

  function fieldInput(top, col, extra = {}) {
    return blessed.textbox({
      parent: fieldsContainer,
      top,
      ...col,
      height: 3,
      border: { type: 'line' },
      style: {
        fg: theme.fg,
        bg: theme.inputBg,
        border: { fg: theme.border },
        focus: { border: { fg: theme.primary } },
      },
      ...extra,
    });
  }

  // Row 0 (both modes): Username | Password(login) / Email(register)
  const usernameLabel = fieldLabel('Username', 0, COL_L);
  const usernameInput = fieldInput(1, COL_L);

  const passwordLabel = fieldLabel('Password', 0, COL_R);
  const passwordInput = fieldInput(1, COL_R, { secret: true });

  // Register-only fields (hidden in login mode)
  const r_emailLabel = fieldLabel('Email', 0, COL_R);
  const r_emailInput = fieldInput(1, COL_R);

  const r_ageLabel = fieldLabel('Age (18-100)', 4, COL_R);
  const r_ageInput = fieldInput(5, COL_R);

  const r_fullNameLabel = fieldLabel('Full Name', 8, COL_L);
  const r_fullNameInput = fieldInput(9, COL_L);

  const r_genderLabel = fieldLabel('Gender (male / female)', 8, COL_R);
  const r_genderInput = fieldInput(9, COL_R);

  // Register grid:
  //   row 0-3 : Username | Email
  //   row 4-7 : Password | Age
  //   row 8-11: Full Name | Gender
  function layoutFields() {
    if (isLoginMode) {
      passwordLabel.top = 0;
      passwordInput.top = 1;
      passwordLabel.left = passwordInput.left = '50%+2';
      passwordLabel.width = passwordInput.width = '50%-2';
    } else {
      passwordLabel.top = 4;
      passwordInput.top = 5;
      passwordLabel.left = passwordInput.left = 0;
      passwordLabel.width = passwordInput.width = '50%-2';
    }
  }

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
    content: '{center}{bold}F2{/bold} Login  ·  {bold}F3{/bold} Register  ·  {bold}Tab{/bold} Next field  ·  {bold}Enter{/bold} Submit  ·  {bold}Esc{/bold} Quit{/center}',
    tags: true,
    style: { fg: theme.fg, bg: theme.statusBarBg },
  });

  // ── State ────────────────────────────────────────────────────
  let isLoginMode = true;
  const regElements = [
    r_emailLabel, r_emailInput,
    r_ageLabel, r_ageInput,
    r_fullNameLabel, r_fullNameInput,
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
    layoutFields();
    // Resize card to fit this mode's fields (clamped to terminal)
    formBox.height = Math.min(
      FIELDS_H[loginMode ? 'login' : 'register'] + CARD_RESERVED,
      termH - logoBottom - 2
    );
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
  const registerFields = [usernameInput, r_emailInput, passwordInput, r_ageInput, r_fullNameInput, r_genderInput];
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

  // Enter-key progression: next field, submit on the last one
  [usernameInput, passwordInput, r_emailInput, r_ageInput, r_fullNameInput, r_genderInput].forEach(inp => {
    inp.key(['enter'], () => {
      const fields = getCurrentFields();
      const idx = fields.indexOf(inp);
      if (idx >= 0 && idx < fields.length - 1) focusField(idx + 1);
      else handleSubmit();
    });
  });

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
