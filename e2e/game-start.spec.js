import { test, expect } from '@playwright/test';

test.describe('Game start E2E tests', () => {
  test('two players start a game and transition to game screen with board rendered', async ({ browser }) => {
    // Open two separate Playwright browser contexts for two independent players
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      // 1. Player 1 (Host) navigates to Home, fills name, creates room
      await hostPage.goto('/');
      await hostPage.locator('#player-name').fill('Alice');
      await hostPage.locator('.home-btn-create').click();

      // Read displayed room code from Player 1's Lobby screen
      const hostCodeDisplay = hostPage.locator('.lobby-code-display');
      await expect(hostCodeDisplay).toBeVisible();
      await expect(hostCodeDisplay).not.toHaveText('-----');
      await expect(hostCodeDisplay).toHaveText(/^[A-Z0-9]{5}$/);
      const roomCode = (await hostCodeDisplay.innerText()).trim();

      // 2. Player 2 (Guest) navigates to Home, fills name + room code, and joins
      await guestPage.goto('/');
      await guestPage.locator('#player-name').fill('Bob');
      await guestPage.locator('#join-code').fill(roomCode);
      await guestPage.locator('.home-btn-join').click();

      // 3. Assert both players are in the lobby
      await expect(hostPage.locator('.lobby-code-display')).toBeVisible();
      await expect(guestPage.locator('.lobby-code-display')).toBeVisible();
      await expect(guestPage.locator('.lobby-code-display')).toHaveText(roomCode);
      await expect(hostPage.locator('.lobby-player-item')).toHaveCount(2);
      await expect(guestPage.locator('.lobby-player-item')).toHaveCount(2);

      // 4. Host clicks the real "Bắt đầu" (start) button (.lobby-btn-start from Lobby.jsx)
      const startBtn = hostPage.locator('.lobby-btn-start');
      await expect(startBtn).toBeVisible();
      await expect(startBtn).toBeEnabled();
      await startBtn.click();

      // 5. Assert BOTH pages transition away from the Lobby screen to the Game screen (.game-screen from Game.jsx)
      await expect(hostPage.locator('.game-screen')).toBeVisible();
      await expect(guestPage.locator('.game-screen')).toBeVisible();
      await expect(hostPage.locator('.lobby-screen')).toHaveCount(0);
      await expect(guestPage.locator('.lobby-screen')).toHaveCount(0);

      // 6. Assert game board components are visibly rendered on both pages:
      // - SeatRing (.seat-ring, .seat-ring__seat)
      // - DrawPile (.draw-pile)
      // - DiscardPile (.discard-pile)
      // - ActionBar (.action-bar)
      for (const page of [hostPage, guestPage]) {
        await expect(page.locator('.seat-ring')).toBeVisible();
        await expect(page.locator('.seat-ring__seat')).toHaveCount(2);
        await expect(page.locator('.draw-pile')).toBeVisible();
        await expect(page.locator('.discard-pile')).toBeVisible();
        await expect(page.locator('.action-bar')).toBeVisible();
      }

      // 7. Assert the "Rút bài" (draw) button (.action-bar__btn--draw from ActionBar.jsx)
      // Both pages render the draw button, but only whichever player's turn it is can draw.
      const hostDrawBtn = hostPage.locator('.action-bar__btn--draw');
      const guestDrawBtn = guestPage.locator('.action-bar__btn--draw');

      await expect(hostDrawBtn).toBeVisible();
      await expect(guestDrawBtn).toBeVisible();

      const hostDrawActive = hostPage.locator('.action-bar__btn--draw:enabled');
      const guestDrawActive = guestPage.locator('.action-bar__btn--draw:enabled');

      // Assert exactly one of the two players is enabled to draw (whichever player's turn it is)
      await expect
        .poll(async () => {
          const hostEnabled = await hostDrawBtn.isEnabled();
          const guestEnabled = await guestDrawBtn.isEnabled();
          return hostEnabled !== guestEnabled;
        })
        .toBe(true);

      const isHostTurn = await hostDrawBtn.isEnabled();
      if (isHostTurn) {
        await expect(hostDrawBtn).toBeEnabled();
        await expect(guestDrawBtn).toBeDisabled();
        await expect(hostDrawActive).toBeVisible();
        await expect(guestDrawActive).toHaveCount(0);
      } else {
        await expect(guestDrawBtn).toBeEnabled();
        await expect(hostDrawBtn).toBeDisabled();
        await expect(guestDrawActive).toBeVisible();
        await expect(hostDrawActive).toHaveCount(0);
      }
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
