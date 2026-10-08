// The toolbar popup: sign in or out, and see whether any games are waiting to save.
const $ = id => document.getElementById(id);
$('sign-up').href = `${ZM_CONFIG.site}account.html`;
$('progress').href = ZM_CONFIG.site;

async function show() {
  const { name, waiting } = await ZM_ACCOUNT.status();
  $('signed-out').hidden = !!name;
  $('signed-in').hidden = !name;
  $('who').textContent = name || '';
  $('waiting').hidden = !waiting;
  $('waiting').textContent = `${waiting} ${waiting === 1 ? 'game is' : 'games are'} waiting to save. ${name ? 'They’ll go up shortly.' : ''}`;
  if (!name) $('name').focus();
}

$('signed-out').addEventListener('submit', async e => {
  e.preventDefault();
  const button = $('sign-in');
  button.disabled = true;
  button.textContent = 'Signing in…';
  $('error').hidden = true;
  try {
    await ZM_ACCOUNT.logIn($('name').value, $('password').value);
    $('password').value = '';
    chrome.runtime.sendMessage({ type: 'flush' }).then(show, show);  // save any games that waited for sign-in
    await show();
  } catch (err) {
    $('error').textContent = err.message;
    $('error').hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Sign in';
  }
});

$('sign-out').addEventListener('click', async () => {
  await ZM_ACCOUNT.logOut();
  await show();
});

show();
