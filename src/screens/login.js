import blessed from 'blessed';
import api from '../api/client.js';
import socket from '../socket/client.js';
import { getCurrentTheme } from '../themes/index.js';
import { saveSession } from '../utils/storage.js';
import { center } from '../utils/terminal.js';

export default function createLoginScreen(screen, onLogin) {
  const theme = getCurrentTheme();

  const container = blessed.box({
    parent: screen,
    width: '100%',
    height: '100%',
    style: { bg: theme.bg },
  });

  const titleBox = blessed.box({
    parent: container,
    top: '15%',
    width: '100%',
    height: 5,
    align: 'center',
    valign: 'middle',
    content: '{bold}{center}\u2593 SOCIAL CLI{/center}{/bold}',
    tags: true,
    style: {
      fg: theme.accent,
      bg: theme.bg,
    },
  });

  const subtitleBox = blessed.box({
    parent: container,
    top: '22%',
    width: '100%',
    height: 3,
    align: 'center',
    content: '{center}Connect \u00b7 Chat \u00b7 Communicate{/center}',
    tags: true,
    style: { fg: theme.muted, bg: theme.bg },
  });

  const formBox = blessed.box({
    parent: container,
    top: '30%',
    width: '60%',
    height: '45%',
    left: 'center',
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.bg,
      border: { fg: theme.border },
    },
  });

  const tabLogin = blessed.text({
    parent: formBox,
    top: 1,
    left: '25%',
    width: '25%',
    height: 1,
    content: '[ LOGIN ]',
    tags: true,
    style: { fg: theme.primary, bg: theme.bg },
    clickable: true,
  });

  const tabRegister = blessed.text({
    parent: formBox,
    top: 1,
    left: '50%',
    width: '25%',
    height: 1,
    content: '[ REGISTER ]',
    tags: true,
    style: { fg: theme.muted, bg: theme.bg },
    clickable: true,
  });

  const fieldsContainer = blessed.box({
    parent: formBox,
    top: 4,
    left: 'center',
    width: '80%',
    height: '80%',
  });

  const usernameLabel = blessed.text({
    parent: fieldsContainer,
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: 'Username:',
    style: { fg: theme.fg },
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
    inputOnFocus: true,
    secret: false,
  });

  const passwordLabel = blessed.text({
    parent: fieldsContainer,
    top: 5,
    left: 0,
    width: '100%',
    height: 1,
    content: 'Password:',
    style: { fg: theme.fg },
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
    inputOnFocus: true,
    secret: true,
  });

  // Registration-only fields
  const emailLabel = blessed.text({
    parent: fieldsContainer,
    top: 10,
    left: 0,
    width: '100%',
    height: 1,
    content: 'Email:',
    style: { fg: theme.fg },
    hidden: true,
  });

  const emailInput = blessed.textbox({
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
    inputOnFocus: true,
    secret: false,
    hidden: true,
  });

  const ageLabel = blessed.text({
    parent: fieldsContainer,
    top: 15,
    left: 0,
    width: '50%',
    height: 1,
    content: 'Age:',
    style: { fg: theme.fg },
    hidden: true,
  });

  const ageInput = blessed.textbox({
    parent: fieldsContainer,
    top: 16,
    left: 0,
    width: '45%',
    height: 3,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.inputBg,
      border: { fg: theme.border },
      focus: { border: { fg: theme.primary } },
    },
    inputOnFocus: true,
    secret: false,
    hidden: true,
  });

  const genderLabel = blessed.text({
    parent: fieldsContainer,
    top: 15,
    left: '50%',
    width: '50%',
    height: 1,
    content: 'Gender (M/F):',
    style: { fg: theme.fg },
    hidden: true,
  });

  const genderInput = blessed.textbox({
    parent: fieldsContainer,
    top: 16,
    left: '50%',
    width: '45%',
    height: 3,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.inputBg,
      border: { fg: theme.border },
      focus: { border: { fg: theme.primary } },
    },
    inputOnFocus: true,
    secret: false,
    hidden: true,
  });

  const messageBox = blessed.text({
    parent: formBox,
    bottom: 5,
    left: 'center',
    width: '80%',
    height: 2,
    content: '',
    tags: true,
    style: { fg: theme.warning },
  });

  const submitBtn = blessed.button({
    parent: formBox,
    bottom: 1,
    left: 'center',
    width: '40%',
    height: 3,
    content: '{center}{bold}LOGIN{/bold}{/center}',
    tags: true,
    border: { type: 'line' },
    style: {
      fg: theme.buttonFg,
      bg: theme.buttonBg,
      border: { fg: theme.buttonBg },
      hover: { bg: theme.accent },
    },
    mouse: true,
  });

  let isLoginMode = true;

  function setMode(loginMode) {
    isLoginMode = loginMode;
    const fields = [emailLabel, emailInput, ageLabel, ageInput, genderLabel, genderInput];

    fields.forEach(f => { f.hidden = loginMode; });

    if (loginMode) {
      tabLogin.setContent('{bold}[ LOGIN ]{/bold}');
      tabLogin.style.fg = theme.primary;
      tabRegister.setContent('[ REGISTER ]');
      tabRegister.style.fg = theme.muted;
      submitBtn.setContent('{center}{bold}LOGIN{/bold}{/center}');
      passwordInput.height = 3;
    } else {
      tabLogin.setContent('[ LOGIN ]');
      tabLogin.style.fg = theme.muted;
      tabRegister.setContent('{bold}[ REGISTER ]{/bold}');
      tabRegister.style.fg = theme.primary;
      submitBtn.setContent('{center}{bold}REGISTER{/bold}{/center}');
      passwordInput.height = 3;
    }

    messageBox.setContent('');
    screen.render();
  }

  tabLogin.on('click', () => setMode(true));
  tabRegister.on('click', () => setMode(false));

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
      if (isLoginMode) {
        submitBtn.setContent('{center}{bold}LOGIN{/bold}{/center}');
      } else {
        submitBtn.setContent('{center}{bold}REGISTER{/bold}{/center}');
      }
    }
    screen.render();
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    const username = usernameInput.getValue().trim();
    const password = passwordInput.getValue();

    if (!username || !password) {
      showMessage('Please fill in all fields', true);
      return;
    }

    setLoading(true);

    try {
      if (isLoginMode) {
        showMessage('Logging in...');
        const result = await api.login({ username, password });
        saveSession(result.accessToken, result.refreshToken, result.user);
        showMessage('{green-fg}Login successful!{/green-fg}');
        setTimeout(() => onLogin(result.user, result.accessToken, result.refreshToken), 500);
      } else {
        const email = emailInput.getValue().trim();
        const age = ageInput.getValue().trim();
        const gender = genderInput.getValue().trim().toUpperCase();

        if (!email || !age || !gender) {
          showMessage('Please fill in all fields', true);
          setLoading(false);
          return;
        }

        if (!['M', 'F', 'MALE', 'FEMALE'].includes(gender)) {
          showMessage('Gender must be M or F', true);
          setLoading(false);
          return;
        }

        const genderValue = gender.startsWith('M') ? 'Male' : 'Female';

        showMessage('Registering...');
        const result = await api.register({
          username,
          email,
          password,
          age: parseInt(age),
          gender: genderValue,
        });

        if (result.requiresEmailVerification) {
          showMessage('{yellow-fg}Registration successful! Check your email for verification.{/yellow-fg}');
          setMode(true);
        } else {
          saveSession(result.accessToken, result.refreshToken, result.user);
          showMessage('{green-fg}Registration successful!{/green-fg}');
          setTimeout(() => onLogin(result.user, result.accessToken, result.refreshToken), 500);
        }
      }
    } catch (error) {
      const msg = error.data?.message || error.data?.error || error.message || 'Operation failed';
      showMessage(`{red-fg}${msg}{/red-fg}`, true);
    } finally {
      setLoading(false);
    }
  }

  submitBtn.on('press', () => { if (!isSubmitting) handleSubmit(); });

  usernameInput.key(['enter'], () => passwordInput.focus());
  passwordInput.key(['enter'], () => handleSubmit());
  emailInput.key(['enter'], () => ageInput.focus());
  ageInput.key(['enter'], () => genderInput.focus());
  genderInput.key(['enter'], () => handleSubmit());

  container.key(['tab'], () => {
    screen.focusNext();
  });

  const helpText = blessed.text({
    parent: container,
    bottom: 0,
    width: '100%',
    height: 1,
    content: '{center}Tab: fields \u00b7 Enter: submit/next \u00b7 Click tabs: switch login/register{/center}',
    tags: true,
    style: { fg: theme.muted, bg: theme.statusBarBg },
  });

  screen.render();
  usernameInput.focus();

  return {
    destroy() {
      container.destroy();
    },
    show() {
      container.show();
      screen.render();
    },
    hide() {
      container.hide();
      screen.render();
    },
  };
}
