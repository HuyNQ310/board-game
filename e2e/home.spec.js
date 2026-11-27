import { test, expect } from '@playwright/test';

test.describe('Home screen and Lobby E2E smoke tests', () => {
  test('creates a room and transitions to lobby screen', async ({ page }) => {
    // 1. Navigate to '/'
    await page.goto('/');

    // 2. Fill player name field with a valid 1-16 char name
    const nameInput = page.locator('#player-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Tester');

    // 3. Click "Tạo phòng" (create room) using real selector from Home.jsx
    const createBtn = page.locator('.home-btn-create');
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // 4. Assert page transitions to Lobby screen (look for real room-code display element from Lobby.jsx)
    const codeDisplay = page.locator('.lobby-code-display');
    await expect(codeDisplay).toBeVisible();

    // 5. Assert a 5-character room code is visible somewhere on the page
    await expect(codeDisplay).not.toHaveText('-----');
    await expect(codeDisplay).toHaveText(/^[A-Z0-9]{5}$/);
    const roomCode = (await codeDisplay.innerText()).trim();
    expect(roomCode).toHaveLength(5);
  });

  test('two players join the same lobby in separate browser contexts', async ({ browser }) => {
    // Open two separate Playwright browser contexts for two independent players
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      // Player 1 (Host) navigates to Home, enters name, creates room
      await hostPage.goto('/');
      await hostPage.locator('#player-name').fill('Alice');
      await hostPage.locator('.home-btn-create').click();

      // Read displayed room code from Player 1's Lobby screen
      const hostCodeDisplay = hostPage.locator('.lobby-code-display');
      await expect(hostCodeDisplay).toBeVisible();
      await expect(hostCodeDisplay).not.toHaveText('-----');
      await expect(hostCodeDisplay).toHaveText(/^[A-Z0-9]{5}$/);
      const roomCode = (await hostCodeDisplay.innerText()).trim();

      // Player 2 (Guest) navigates to Home, fills name + room code, and joins
      await guestPage.goto('/');
      await guestPage.locator('#player-name').fill('Bob');
      await guestPage.locator('#join-code').fill(roomCode);
      await guestPage.locator('.home-btn-join').click();

      // Assert both pages now show Lobby screen
      await expect(hostPage.locator('.lobby-code-display')).toBeVisible();
      await expect(guestPage.locator('.lobby-code-display')).toBeVisible();
      await expect(guestPage.locator('.lobby-code-display')).toHaveText(roomCode);

      // Assert both pages show 2 player rows in the lobby player list (.lobby-player-item from Lobby.jsx)
      await expect(hostPage.locator('.lobby-player-item')).toHaveCount(2);
      await expect(guestPage.locator('.lobby-player-item')).toHaveCount(2);

      // Assert both player names are listed on both screens
      await expect(hostPage.locator('.lobby-player-list')).toContainText('Alice');
      await expect(hostPage.locator('.lobby-player-list')).toContainText('Bob');
      await expect(guestPage.locator('.lobby-player-list')).toContainText('Alice');
      await expect(guestPage.locator('.lobby-player-list')).toContainText('Bob');

      // Assert player count indicator shows 2/6
      await expect(hostPage.locator('.lobby-player-count')).toHaveText('2/6');
      await expect(guestPage.locator('.lobby-player-count')).toHaveText('2/6');
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
